const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder.js');
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

const voteCounts = new Map();

const FORUM_CHANNEL_ID = '1340952491818487819';
const VOTING_CHANNEL_ID = '1340952744281899098';
const TAG_ID = '1340997233738514452';

async function scrapeForum(interaction, historyDuration, channelId) {
    const endDate = new Date();
    const startDate = new Date(endDate - historyDuration);

    const threads = await fetchThreads(interaction, channelId, startDate, endDate);
    
    const attachmentCache = new Map();

    const filteredThreads = await Promise.all(threads.map(async thread => {
        const messages = await thread.messages.fetch();
        const ownerMessages = messages.filter(message => message.author.id === thread.ownerId);
        const hasMedia = ownerMessages.some(message => {
            const attachment = message.attachments.find(attachment => 
                attachment.contentType.startsWith('image/')
            );
            const embedWithImage = message.embeds.find(embed => embed && embed.url);
            if (attachment) {
                attachmentCache.set(thread.id, attachment.url);
                return true;
            } else if (embedWithImage) {
                attachmentCache.set(thread.id, embedWithImage.url);
                return true;
            }
            return false;
        });
        return !thread.appliedTags.includes(TAG_ID) && hasMedia ? thread : null;
    }));

    const validThreads = filteredThreads.filter(thread => thread !== null);

    return validThreads.map((thread, index) => {
        const attachment = attachmentCache.get(thread.id);

        return { ...thread, attachment, index };
    });
}

async function fetchThreads(interaction, channelId, startDate, endDate) {
    const channel = await interaction.client.channels.fetch(channelId);
    const threads = await channel.threads.fetchActive();
    let allThreads = [];

    threads.threads.forEach(thread => {
        const threadDate = new Date(thread.createdTimestamp);
        if (threadDate >= startDate && threadDate <= endDate) {
            allThreads.push(thread);
        }
    });

    return allThreads;
}

function generateVoteSummary() {
    let voteSummary = '';
    const sortedVotes = Array.from(voteCounts.entries()).sort((a, b) => b[1].count - a[1].count);
    for (const [key, value] of sortedVotes) {
        voteSummary += `${value.count} votes - ${key}\n`;
    }
    return voteSummary;
}

async function recordVote(i) {
    const userId = i.user.id;
    const selectedValue = i.values[0];

    // Check if the user has already voted for something else
    for (const [key, value] of voteCounts.entries()) {
        if (value.users.includes(userId)) {
            // Remove the user's previous vote
            value.count -= 1;
            value.users = value.users.filter(id => id !== userId);
            voteCounts.set(key, value);
            break;
        }
    }

    // Add the new vote
    const currentCount = voteCounts.get(selectedValue) || { count: 0, users: [] };
    currentCount.count += 1;
    currentCount.users.push(userId);
    voteCounts.set(selectedValue, currentCount);

    const embed = createEmbed({
        title: 'Vote Recorded',
        description: `You voted for post ${selectedValue}`,
        color: '#00fab3',
    });

    // Add the rest of the votes to the embed
    const voteSummary = generateVoteSummary();
    embed.addFields({ name: 'Current Votes', value: voteSummary });

    await i.reply({ embeds: [embed], ephemeral: true });
}

async function sendFinalVoteCount(interaction, embeds, endTime) {
    const finalSummary = generateVoteSummary();

    const finalEmbed = createEmbed({
        title: 'Final Vote Count',
        description: `Voting ended <t:${Math.floor(endTime / 1000)}:R>\nHere are the final vote counts for each post:`,
        color: '#00fab3',
        fields: [{ name: 'Votes', value: finalSummary }]
    });

    await interaction.editReply({ embeds: [...embeds, finalEmbed], components: [] });
}

module.exports = {
    category: 'custom',
    data: new SlashCommandBuilder()
        .setName('createpoll')
        .setDescription('Create the weekly poll for rice rice baby!')
        .addIntegerOption(option => 
            option.setName('duration')
            .setDescription('The duration of the poll in days.')
            .setRequired(true))
        .addIntegerOption(option => 
            option.setName('days')
            .setDescription('The number of days to scrape from the forum channel. Defaults to days since the last poll.')
            .setRequired(false)),
    async execute(interaction) {
       
        let historyDuration = interaction.options.getInteger('days') * (1000 * 60 * 60 * 24);
        const duration = interaction.options.getInteger('duration');
        const durationMs = duration * 24 * 60 * 60 * 1000;
        let endTime = Date.now() + durationMs;

        if (!historyDuration) {
            const channel = await interaction.client.channels.fetch(VOTING_CHANNEL_ID);
            const messages = await channel.messages.fetch({ limit: 1 });
            const lastMessage = messages.first();
            const lastMessageDate = new Date(lastMessage.createdTimestamp);
            const now = new Date();
            historyDuration = Math.ceil((now - lastMessageDate));
        }

        const posts = await scrapeForum(interaction, historyDuration, FORUM_CHANNEL_ID);

        if (posts.length === 0) {
            return interaction.reply({ content: `No posts found for the given period (<t:${Math.floor((new Date() - historyDuration)/1000)}:R> to now).`, ephemeral: true });
        }

        const embeds = posts.map(post => createEmbed({
            title: `${post.name}`,
            titleUrl: `https://discord.com/channels/${interaction.guild.id}/${post.id}`,
            description: `<@${post.ownerId}>`,
            color: '#0abfff',
            imageUrl: post.attachment,
        }));

        const options = await Promise.all(posts.map(async post => {
            const member = await interaction.guild.members.fetch(post.ownerId);
            const displayName = member ? member.displayName : post.ownerId;
            const postName = `${post.name}, by ${displayName}`;
            voteCounts.set(postName, { count: 0, users: [] });
            return {
                label: postName,
                value: postName
            };
        }));

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('rice-vote')
                    .setPlaceholder('Vote for a post!')
                    .addOptions(options)
            );

        // Add the end vote button
        const endVoteButton = new ButtonBuilder()
            .setCustomId('end-vote')
            .setLabel('End Vote')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!interaction.member.permissions.has('MANAGE_MESSAGES'));

        // Add the view results button
        const viewResultsButton = new ButtonBuilder()
            .setCustomId('view-results')
            .setLabel('View Results')
            .setStyle(ButtonStyle.Primary);

        const buttonRow = new ActionRowBuilder().addComponents(viewResultsButton, endVoteButton);

        // Add the remaining time embed
        const remainingTimeEmbed = createEmbed({
            title: 'Time Left',
            description: `Voting ends <t:${Math.floor(endTime / 1000)}:R>`,
            color: '#926cf9',
        });

        const response = await interaction.reply({ embeds: [...embeds, remainingTimeEmbed], components: [row, buttonRow], fetchReply: true });
        
        // Create an InteractionCollector to listen for votes
        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: durationMs
        });

        const buttonCollector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: durationMs
        });

        buttonCollector.on('collect', async i => {
            if (i.customId === 'end-vote') {
                collector.stop();
                buttonCollector.stop();
                endTime = Date.now();
                await sendFinalVoteCount(interaction, embeds, endTime);
            } else if (i.customId === 'view-results') {
                const voteSummary = generateVoteSummary();

                const resultsEmbed = createEmbed({
                    title: 'Current Vote Summary',
                    description: 'Here are the current vote counts for each post:',
                    color: '#00fab3',
                    fields: [{ name: 'Votes', value: voteSummary }]
                });

                await i.reply({ embeds: [resultsEmbed], ephemeral: true });
            }
        });

        collector.on('collect', async i => {
            if (i.customId === 'rice-vote') {
                await recordVote(i);
            }
        });

        collector.on('end', async (collected, reason) => {
            await sendFinalVoteCount(interaction, embeds, endTime);
        });
    },
};