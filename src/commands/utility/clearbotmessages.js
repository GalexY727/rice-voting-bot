const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
	category: 'utility',
	data: new SlashCommandBuilder()
		.setName('clearbotmessages')
		.setDescription('Clears all messages from the bot sent within the past 5 minutes.')
		.addIntegerOption(option =>
			option.setName('minutes_ago')
				.setDescription('The number of minutes to look back for bot messages.')
				.setRequired(false))
		.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
	async execute(interaction) {
		const minutesAgo = interaction.options.getInteger('minutes_ago') || 5;
		const channel = interaction.channel;
		const botId = interaction.client.user.id;
		const timestampAgo = Date.now() - minutesAgo * 60 * 1000;

		try {
			const messages = await channel.messages.fetch({ limit: 100 });
			const botMessages = messages.filter(msg => msg.author.id === botId && msg.createdTimestamp >= timestampAgo);

			await channel.bulkDelete(botMessages);

			await interaction.reply({ content: `Cleared all bot messages from the past ${minutesAgo} minutes.`, ephemeral: true });
		} catch (error) {
			console.error('Error clearing bot messages:', error);
			await interaction.reply({ content: 'There was an error clearing the bot messages.', ephemeral: true });
		}
	},
};