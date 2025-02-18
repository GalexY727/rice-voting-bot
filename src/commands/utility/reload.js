const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

function attemptCommandReload(command, commands) {
	delete require.cache[require.resolve(`../${command.category}/${command.data.name}.js`)];
	try {
		commands.delete(command.data.name);
		const newCommand = require(`../${command.category}/${command.data.name}.js`);
		commands.set(newCommand.data.name, newCommand);
		return `Command \`${newCommand.data.name}\` was reloaded!\n`;
	} catch (error) {
		console.error(error);
		return `There was an error while reloading command \`${command.data.name}\`:\n\`${error.message}\``;
	}
}

module.exports = {
	category: 'utility',
	data: new SlashCommandBuilder()
		.setName('reload')
		.setDescription('Reloads a command.')
		.addStringOption(option =>
			option.setName('command')
				.setDescription('The command to reload.')
				.setRequired(false)
				.setAutocomplete(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
	async autocomplete(interaction) {
		const focusedValue = interaction.options.getFocused().trim().toLowerCase();
		const choices = interaction.client.commands.map(command => command.data.name);
		const filtered = choices.filter(choice => choice.startsWith(focusedValue));
		await interaction.respond(
			filtered.map(choice => ({ name: choice, value: choice })),
		);
	},
	async execute(interaction) {
		const commandName = interaction.options.getString('command')?.toLowerCase();
		const commands = interaction.client.commands;

		if (!commandName) {
			await interaction.reply({
				content: 'Reloading all commands...',
				ephemeral: true
			});
			let message = '';
			
			const oldCommands = commands.clone();
			oldCommands.forEach(async (command) => {
				message += attemptCommandReload(command, commands);
				await interaction.editReply({
					content: message,
				});
			});
            message += 'All commands reloaded!';
				await interaction.editReply({
					content: message,
				});
		} else {
			const command = commands.get(commandName);

			if (!command) {
				return interaction.reply({
					content: `There is no command with the name \`${commandName}\``,
					ephemeral: true
				});
			}

			await interaction.reply({
				content: attemptCommandReload(command, commands),
				ephemeral: true
			});
		}
	},
};
