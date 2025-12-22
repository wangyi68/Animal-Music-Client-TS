import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig } from '../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../types/index.js';
import { table } from 'table';
import moment from 'moment';
import 'moment-duration-format';

const command: Command = {
    name: 'shard',
    description: 'Xem thông tin chi tiết về các Shard',
    aliases: ['shards', 'stats'],
    config: createCommandConfig({
        category: 'info',
        usage: 'shard',
        cooldown: 10
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('shard')
        .setDescription('Xem thông tin chi tiết về các Shard') as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const { message } = context;
        const client = message.client as BotClient;
        const tableResult = await getShardInfo(client);

        await message.reply(`\`\`\`asciidoc\n${tableResult}\n\`\`\``);
        return { type: 'success' };
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const { interaction } = context;
        const client = interaction.client as BotClient;

        await interaction.deferReply();
        const tableResult = await getShardInfo(client);

        await interaction.editReply(`\`\`\`asciidoc\n${tableResult}\n\`\`\``);
        return { type: 'success' };
    }
};

async function getShardInfo(client: BotClient): Promise<string> {
    const durationBot = (moment.duration(client.uptime) as any).format("D[d], H[h], m[m], s[s]");

    const data: any[] = [
        ['SID', 'Server', 'Members', 'UpTime', 'Ping', 'Ram', 'HRam'],
    ];

    let results: any[] = [];

    if (client.shard) {
        results = await client.shard.broadcastEval(c => {
            return [
                c.shard?.ids[0] ?? 0,
                c.guilds.cache.size,
                c.guilds.cache.reduce((prev, guild) => prev + guild.memberCount, 0),
                c.channels.cache.size,
                c.uptime,
                c.ws.ping,
                process.memoryUsage().heapUsed,
                process.memoryUsage().heapTotal
            ];
        });
    } else {
        // Single shard mode fallback
        results = [[
            0,
            client.guilds.cache.size,
            client.guilds.cache.reduce((prev, guild) => prev + guild.memberCount, 0),
            client.channels.cache.size,
            client.uptime,
            client.ws.ping,
            process.memoryUsage().heapUsed,
            process.memoryUsage().heapTotal
        ]];
    }

    let totalGuilds = 0;
    let totalMembers = 0;
    let totalRam = 0;
    let totalHRam = 0;

    for (const res of results) {
        totalGuilds += res[1];
        totalMembers += res[2];
        totalRam += res[6];
        totalHRam += res[7];

        // Format uptime for each shard if needed, but sample code leaves it empty in loop except valid uptime?
        // Sample code: j[5] + 'ms' -> ping. j[0] -> SID.
        // Sample says: data.push([j[0], j[1]..., '', j[5] + 'ms'...]) -> Uptime column is empty in rows?
        // Let's verify sample: `data.push([j[0], ..., '', ...])`. Yes, UpTime is empty string in rows.

        data.push([
            res[0],
            res[1].toLocaleString('en-US'),
            res[2].toLocaleString('en-US'),
            '', // UpTime column empty for shards in sample
            res[5] + 'ms',
            formatBytes(res[6]),
            formatBytes(res[7])
        ]);
    }

    // Total row
    data.push([
        'TOT',
        totalGuilds.toLocaleString('en-US'),
        totalMembers.toLocaleString('en-US'),
        durationBot,
        "",
        formatBytes(totalRam),
        formatBytes(totalHRam)
    ]);

    return table(data, {
        header: {
            alignment: "center",
            content: "Shards Info\nThống kê chi tiết tài nguyên bot"
        },
        columns: {
            0: { alignment: 'center' },
            1: { alignment: 'center' },
            2: { alignment: 'center' },
            3: { alignment: 'center' },
            4: { alignment: 'center' },
            5: { alignment: 'center' },
            6: { alignment: 'center' }
        }
    });
}

function formatBytes(bytes: number) {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
}

export default command;
