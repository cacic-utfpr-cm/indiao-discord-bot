const express = require('express');
const app = express();
app.get("/", (req, res) => {
	res.sendStatus(200);
})
app.listen('3000')
// Require the necessary discord.js classes
const { Client, Intents, MessageEmbed } = require('discord.js');
const ytdl = require('ytdl-core');
const google = require('googleapis')
const { token, prefix, googleAPI } = require('./config.json');

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES,Intents.FLAGS.GUILD_VOICE_STATES] });
const { getVoiceConnection, joinVoiceChannel, VoiceConnectionStatus, AudioPlayerStatus, createAudioResource, entersState, createAudioPlayer, NoSubscriberBehavior } = require('@discordjs/voice');

client.queue = new Map()

const youtube = new google.youtube_v3.Youtube({
    version: 'v3',
    auth: googleAPI
})

// When the client is ready, run this code (only once)
client.once("ready", () => {
    console.log("Ayo, I booted!");
    client.user.setActivity("i!help | release v1.4")
    client.user.setStatus("idle");
});

client.on("error", error => {
    console.log(error);
    return;
});

client.on("messageCreate", async message => {
    // Filters
    if (!message.guild) return
    if (message.author.bot) return
    if (!message.content.startsWith(prefix)) return
    
    // Spliting message
    let args = message.content.split(prefix)[1].split(' ')
    let command = args[0]
    
    // Handling message
    if (command.toLowerCase() === "ping") {
        message.reply("The **API** ping is " + "`" + client.ws.ping + "ms`. " + `The **message** ping is ` + "`" + (Date.now() - message.createdTimestamp) + "ms`.")
    }

    if (command.toLowerCase() === "join") {
        if (!message.member.voice.channel) return
        const connection = joinVoiceChannel({
            channelId: message.member.voice.channel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
        });

        connection.on(VoiceConnectionStatus.Ready, () => {
            console.log('The connection has entered the Ready state - ready to play audio!');
        });

        connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
                // Seems to be reconnecting to a new channel - ignore disconnect
            } catch (error) {
                // Seems to be a real disconnect which SHOULDN'T be recovered from
                connection.destroy();
            }
        });
    }

    if (command.toLowerCase() === "leave") {
        if (!message.member.voice.channel) return
        const connection = getVoiceConnection(message.guild.id);
        connection.destroy();
    }

    if (command.toLowerCase() === "play") {
        if (!message.member.voice.channel) return
        if (args.length < 2) return message.reply('You need to add a link or a name')
        
        const connection = getVoiceConnection(message.guild.id);
        if (connection){
            try{
                if (connection._state.subscription.player) console.log("Player already exists")
            }catch{
                const player = createAudioPlayer({
                    behaviors: {
                        noSubscriber: NoSubscriberBehavior.Stop,
                    },
                });
                const subscription = connection.subscribe(player);
                client.queue.set(message.guild.id, [])
                player.on('error', error => {
                    console.error(error);
                });
            }
        }else{
            return message.reply("Use i!join so I can join your channel")
        }

        if (ytdl.validateURL(args[1])){
            let videoID = ytdl.getURLVideoID(args[1])
            let info = await ytdl.getInfo(videoID);
            let videoInfo = {
                title: info.videoDetails.title,
                author: info.videoDetails.author.name,
                thumbnail: `https://i.ytimg.com/vi/${videoID}/default.jpg`,
                url: args[1]
            }
            createQueueSongResource(message, videoInfo)
            
        } else {
            let name = args.slice(1,args.length).join(' ')
            youtube.search.list({
                q: name,
                part: 'snippet',
                fields: 'items(id(videoId), snippet(title, channelTitle, thumbnails(default(url))))',
                type: 'video'
            }, function (err, res) {
                if (err) {
                    console.log(err)
                }
                if (res) {
                    // console.log(JSON.stringify(res.data))
                    let id = res.data.items[0].id.videoId
                    let videoURL = 'https://youtube.com/watch?v=' + id
                    let videoInfo = {
                        title: res.data.items[0].snippet.title,
                        author: res.data.items[0].snippet.channelTitle,
                        thumbnail: res.data.items[0].snippet.thumbnails.default.url,
                        url: videoURL
                    }
                    createQueueSongResource(message, videoInfo)
                }
            })
        }
    }

    if (command.toLowerCase() === "pause"){
        const player = getPlayer(message)
        player.pause();
    }

    if (command.toLowerCase() === "resume"){
        const player = getPlayer(message)
        player.unpause();
    }

    if (command.toLowerCase() === "stop"){
        const player = getPlayer(message)
        player.stop();
    }

    if (command.toLowerCase() === "status"){
        if (message.member.id === ownerID)
						console.log(getPlayerStatus(message))
    }

		if (command.toLowerCase() === "help"){
        const embed = new MessageEmbed()
            .setColor([0, 0, 200])
            .setTitle('Comandos')
            .setAuthor('Indião v1.4')
            .addFields(
                { name: 'i!ping', value: 'Retorna o ping do servidor' },
                { name: 'i!join', value: 'Necessário para que o bot entre no seu canal' },
                { name: 'i!leave', value: 'Bot sai do canal' },
                { name: 'i!play <url/nome>', value: 'Toca música, podendo usar como parâmetro o url ou nome no youtube' },
                { name: 'i!stop', value: 'Para a música' },
                { name: 'i!pause', value: 'Pausa a música' },
                { name: 'i!resume', value: 'Retorna a música pausada' },
            )
            .setURL('https://github.com/cacic-utfpr-cm/indiao-discord-bot')
            .setFooter('Mais melhorias virão na versão 1.7');
        message.channel.send({ embeds: [embed] });
    }
    
})

const createQueueSongResource = (message, songInfo) => {
    const resource = createAudioResource(ytdl(songInfo.url, { filter : 'audioonly' }));
    let playlistID = message.guild.id
    client.queue.set(playlistID, [...client.queue.get(playlistID), resource])
    let embed = new MessageEmbed()
        .setColor([255, 0, 0])
        .setTitle(`${songInfo.title}`)
        .setAuthor(`${songInfo.author}`)
        .setDescription('Song added')
        .setThumbnail(`${songInfo.thumbnail}`)
        .setURL(`${songInfo.url}`)

    if (getPlayerStatus(message) === 'playing'){
        message.channel.send({ embeds: [embed] })
        message.delete()
    }
    else if (getPlayerStatus(message) === 'idle'){
        playMusic(message)
        message.channel.send({ embeds: [embed] })
        message.delete()
    }
}

const getPlayer = (msg) => {
    const connection = getVoiceConnection(msg.guild.id);
    return connection._state.subscription.player
}

const getPlayerStatus = (msg) => {
    const connection = getVoiceConnection(msg.guild.id);
    return connection._state.subscription.player._state.status
}

const playMusic = (message) => {
    player = getPlayer(message)
    player.play(client.queue.get(message.guild.id)[0])
    player.on(AudioPlayerStatus.Idle, () => {
        client.queue.get(message.guild.id).shift()

        if (client.queue.get(message.guild.id).length){
            playMusic(message, player)
        }
    })

}

// Login to Discord with your client's token
client.login(token);