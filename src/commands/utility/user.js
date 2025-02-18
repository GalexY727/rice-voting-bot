const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
	category: 'utility',
	data: new SlashCommandBuilder()
		.setName('user')
		.setDescription('Provides information about you!'),
	async execute(interaction) {
		// interaction.user is the object representing the User who ran the command
		// interaction.member is the GuildMember object, which represents the user in the specific guild
		const joinedTimestamp = Math.floor(interaction.member.joinedAt.getTime() / 1000);
		await interaction.reply({
			content: `You joined <t:${joinedTimestamp}:R>.`,
			ephemeral: true,
		});
	},
};