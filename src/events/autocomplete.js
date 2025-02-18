const { Events } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
        if (interaction.isChatInputCommand()) return;
        if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);
    
            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }
    
            try {
                await command.autocomplete(interaction);
            } catch (error) {
                console.error(error);
            }
        }
    },
};    