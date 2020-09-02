const Discord = require('discord.js');
const bot =  new Discord.Client();
const { token, prefix } = require('./config.json');
const ytdl = require('ytdl-core');
const streamOptions = {seek: 0, volume: 1}

bot.login(token);

bot.on('ready',() => {
	console.log('I am ready');
})

bot.on('message', msg => {
	if (msg.author.bot){
		return
	}

	if(msg.content.toLowerCase().startsWith(prefix)){
		let msg_no_prefix = msg.content.split(prefix);
		let args = msg_no_prefix[1].split(" ");
		
		if (args[0] === "play"){
			let VoiceChannel = msg.member.voice.channel;
	
			if(VoiceChannel == null){
				console.log('Channel not found');
			}
			
			if (VoiceChannel !== null){
				console.log('Channel found');
	
				VoiceChannel.join()
				.then(connection =>{
	
					const stream = ytdl(args[1], {filter:'audioonly'});
	
					const DJ = connection.play(stream, streamOptions);
					DJ.on('end', end =>{
						VoiceChannel.leave();
					})
				})
				.catch(console.error);
			}
		}
	}

})