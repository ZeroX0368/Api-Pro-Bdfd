
const express = require('express');
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

// Store active bot clients for proper cleanup
const activeClients = new Map(); // channelId -> { client, guildId, botToken }

// Middleware
app.use(express.json());

// Validation middleware for headers
const validateHeaders = (req, res, next) => {
    const botToken = req.headers['x-bot-token'];
    const guildId = req.headers['x-guild-id'];
    
    if (!botToken) {
        return res.status(400).json({
            error: 'Missing bot token',
            detail: 'Please provide x-bot-token header'
        });
    }
    
    if (!guildId) {
        return res.status(400).json({
            error: 'Missing guild ID',
            detail: 'Please provide x-guild-id header'
        });
    }
    
    req.botToken = botToken;
    req.guildId = guildId;
    next();
};

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'Discord Bot API Server is running',
        endpoints: [
            'POST /addroleall - Add role to all guild members',
            'POST /roleremoveall - Remove role from all guild members',
            'POST /unbanall - Unban all users from the server',
            'POST /set-ai - Generate AI text using Pollinations API',
            'POST /reset-ai - Reset AI conversational bot for a channel'
        ]
    });
});

// Add role to all members endpoint
app.post('/addroleall', validateHeaders, async (req, res) => {
    try {
        const { roleId } = req.body;
        const { botToken, guildId } = req;
        
        if (!roleId) {
            return res.status(400).json({
                error: 'Missing roleId in request body',
                detail: 'Please provide a roleId to add to all users'
            });
        }
        
        // Create temporary client for this request
        const tempClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers
            ]
        });
        
        await tempClient.login(botToken);
        
        // Wait for client to be ready
        await new Promise((resolve) => {
            tempClient.once('ready', resolve);
        });
        
        const guild = await tempClient.guilds.fetch(guildId);
        
        if (!guild) {
            await tempClient.destroy();
            return res.status(404).json({
                error: 'Guild not found',
                detail: 'The specified guild ID could not be found'
            });
        }
        
        // Check bot permissions
        const botMember = await guild.members.fetch(tempClient.user.id);
        if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            await tempClient.destroy();
            return res.status(403).json({
                error: 'Insufficient permissions',
                detail: 'Bot lacks MANAGE_ROLES permission'
            });
        }
        
        // Get the role
        const role = await guild.roles.fetch(roleId);
        if (!role) {
            await tempClient.destroy();
            return res.status(404).json({
                error: 'Role not found',
                detail: `Role with ID ${roleId} not found in the guild`
            });
        }
        
        // Check if bot can manage this role
        if (role.position >= botMember.roles.highest.position) {
            await tempClient.destroy();
            return res.status(403).json({
                error: 'Cannot manage role',
                detail: 'Bot role position is not high enough to manage this role'
            });
        }
        
        // Fetch all members
        const members = await guild.members.fetch();
        
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;
        const errors = [];
        
        for (const [memberId, member] of members) {
            try {
                // Check if member already has the role
                if (member.roles.cache.has(roleId)) {
                    skipCount++;
                    continue;
                }
                
                // Add role to member (including bots)
                await member.roles.add(role);
                successCount++;
                
                // Add small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                errorCount++;
                errors.push(`Failed to add role to ${member.user.username}: ${error.message}`);
            }
        }
        
        await tempClient.destroy();
        
        res.json({
            success: true,
            roleId: roleId,
            roleName: role.name,
            totalMembers: members.size,
            successCount: successCount,
            skipCount: skipCount,
            errorCount: errorCount,
            errors: errors.slice(0, 10), // Limit errors shown
            detail: `Added role "${role.name}" to ${successCount} users (including bots). Skipped ${skipCount} users (already had role). ${errorCount} errors occurred.`
        });
        
    } catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            detail: error.message
        });
    }
});

// Remove role from all members endpoint
app.post('/roleremoveall', validateHeaders, async (req, res) => {
    try {
        const { roleId } = req.body;
        const { botToken, guildId } = req;
        
        if (!roleId) {
            return res.status(400).json({
                error: 'Missing roleId in request body',
                detail: 'Please provide a roleId to remove from all users'
            });
        }
        
        // Create temporary client for this request
        const tempClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers
            ]
        });
        
        await tempClient.login(botToken);
        
        // Wait for client to be ready
        await new Promise((resolve) => {
            tempClient.once('ready', resolve);
        });
        
        const guild = await tempClient.guilds.fetch(guildId);
        
        if (!guild) {
            await tempClient.destroy();
            return res.status(404).json({
                error: 'Guild not found',
                detail: 'The specified guild ID could not be found'
            });
        }
        
        // Check bot permissions
        const botMember = await guild.members.fetch(tempClient.user.id);
        if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            await tempClient.destroy();
            return res.status(403).json({
                error: 'Insufficient permissions',
                detail: 'Bot lacks MANAGE_ROLES permission'
            });
        }
        
        // Get the role
        const role = await guild.roles.fetch(roleId);
        if (!role) {
            await tempClient.destroy();
            return res.status(404).json({
                error: 'Role not found',
                detail: `Role with ID ${roleId} not found in the guild`
            });
        }
        
        // Check if bot can manage this role
        if (role.position >= botMember.roles.highest.position) {
            await tempClient.destroy();
            return res.status(403).json({
                error: 'Cannot manage role',
                detail: 'Bot role position is not high enough to manage this role'
            });
        }
        
        // Fetch all members
        const members = await guild.members.fetch();
        
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;
        const errors = [];
        
        for (const [memberId, member] of members) {
            try {
                // Check if member doesn't have the role
                if (!member.roles.cache.has(roleId)) {
                    skipCount++;
                    continue;
                }
                
                // Remove role from member (including bots)
                await member.roles.remove(role);
                successCount++;
                
                // Add small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                errorCount++;
                errors.push(`Failed to remove role from ${member.user.username}: ${error.message}`);
            }
        }
        
        await tempClient.destroy();
        
        res.json({
            success: true,
            roleId: roleId,
            roleName: role.name,
            totalMembers: members.size,
            successCount: successCount,
            skipCount: skipCount,
            errorCount: errorCount,
            errors: errors.slice(0, 10), // Limit errors shown
            detail: `Removed role "${role.name}" from ${successCount} users (including bots). Skipped ${skipCount} users (didn't have role). ${errorCount} errors occurred.`
        });
        
    } catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            detail: error.message
        });
    }
});

// Unban all users endpoint
app.post('/unbanall', validateHeaders, async (req, res) => {
    try {
        const { botToken, guildId } = req;
        
        // Create temporary client for this request
        const tempClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildBans
            ]
        });
        
        await tempClient.login(botToken);
        
        // Wait for client to be ready
        await new Promise((resolve) => {
            tempClient.once('ready', resolve);
        });
        
        const guild = await tempClient.guilds.fetch(guildId);
        
        if (!guild) {
            await tempClient.destroy();
            return res.status(404).json({
                error: 'Guild not found',
                detail: 'The specified guild ID could not be found'
            });
        }
        
        // Check bot permissions
        const botMember = await guild.members.fetch(tempClient.user.id);
        if (!botMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            await tempClient.destroy();
            return res.status(403).json({
                error: 'Insufficient permissions',
                detail: 'Bot lacks BAN_MEMBERS permission'
            });
        }
        
        // Fetch all bans
        const bans = await guild.bans.fetch();
        
        if (bans.size === 0) {
            await tempClient.destroy();
            return res.json({
                success: true,
                totalBans: 0,
                successCount: 0,
                errorCount: 0,
                errors: [],
                detail: 'No banned users found in this server'
            });
        }
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        const unbannedUsers = [];
        
        for (const [userId, ban] of bans) {
            try {
                await guild.members.unban(userId, 'Bulk unban via API');
                successCount++;
                unbannedUsers.push({
                    id: userId,
                    username: ban.user.username,
                    tag: ban.user.tag
                });
                
                // Add small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                errorCount++;
                errors.push(`Failed to unban ${ban.user.username}: ${error.message}`);
            }
        }
        
        await tempClient.destroy();
        
        res.json({
            success: true,
            totalBans: bans.size,
            successCount: successCount,
            errorCount: errorCount,
            errors: errors.slice(0, 10), // Limit errors shown
            unbannedUsers: unbannedUsers.slice(0, 20), // Limit users shown in response
            detail: `Successfully unbanned ${successCount} out of ${bans.size} banned users. ${errorCount} errors occurred.`
        });
        
    } catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            detail: error.message
        });
    }
});

// AI text generation endpoint with conversational bot
app.post('/set-ai', validateHeaders, async (req, res) => {
    try {
        const { prompt, model = 'openai', jsonMode = false, enableConversation = false } = req.body;
        const { botToken, guildId } = req;
        const channelId = req.headers['x-channel-id'];
        
        if (!channelId) {
            return res.status(400).json({
                error: 'Missing channel ID',
                detail: 'Please provide x-channel-id header'
            });
        }
        
        // Create persistent client for conversation mode or temporary for single prompt
        const clientOptions = {
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        };
        
        const client = new Client(clientOptions);
        
        await client.login(botToken);
        
        // Wait for client to be ready
        await new Promise((resolve) => {
            client.once('ready', resolve);
        });
        
        const guild = await client.guilds.fetch(guildId);
        
        if (!guild) {
            await client.destroy();
            return res.status(404).json({
                error: 'Guild not found',
                detail: 'The specified guild ID could not be found'
            });
        }
        
        const channel = await guild.channels.fetch(channelId);
        
        if (!channel) {
            await client.destroy();
            return res.status(404).json({
                error: 'Channel not found',
                detail: 'The specified channel ID could not be found'
            });
        }
        
        // Check bot permissions
        const botMember = await guild.members.fetch(client.user.id);
        if (!channel.permissionsFor(botMember).has(PermissionsBitField.Flags.SendMessages)) {
            await client.destroy();
            return res.status(403).json({
                error: 'Insufficient permissions',
                detail: 'Bot lacks SEND_MESSAGES permission in this channel'
            });
        }
        
        // Function to make AI request
        const callPollinationsAPI = async (messages) => {
            try {
                // Convert conversation to a simple prompt format
                let prompt = messages.map(msg => {
                    if (msg.role === 'system') return `System: ${msg.content}`;
                    if (msg.role === 'user') return `User: ${msg.content}`;
                    if (msg.role === 'assistant') return `Assistant: ${msg.content}`;
                    return msg.content;
                }).join('\n');

                const response = await axios.post('https://text.pollinations.ai/', {
                    messages: [{ role: 'user', content: prompt }],
                    model: model,
                    jsonMode: jsonMode
                }, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                return response.data;
            } catch (error) {
                console.log(`Pollinations API Error: ${error}`);
                throw error;
            }
        };
        
        // Function to send chunked messages to Discord
        const sendChunkedMessage = async (content, targetChannel) => {
            const chunks = [];
            if (content.length > 2000) {
                for (let i = 0; i < content.length; i += 2000) {
                    chunks.push(content.substring(i, i + 2000));
                }
            } else {
                chunks.push(content);
            }
            
            const sentMessages = [];
            for (const chunk of chunks) {
                try {
                    const message = await targetChannel.send(chunk);
                    sentMessages.push({
                        id: message.id,
                        content: chunk.substring(0, 100) + (chunk.length > 100 ? '...' : '')
                    });
                    
                    if (chunks.length > 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (error) {
                    console.error('Failed to send message chunk:', error);
                }
            }
            
            return { chunks: chunks.length, sentMessages };
        };
        
        // If conversation mode is enabled, set up the message listener
        if (enableConversation) {
            // Store the client for this channel
            activeClients.set(channelId, {
                client: client,
                guildId: guildId,
                botToken: botToken
            });
            
            // Add cleanup when client disconnects
            client.on('disconnect', () => {
                activeClients.delete(channelId);
                console.log(`AI bot client disconnected for channel ${channelId}`);
            });
            
            client.on('messageCreate', async (message) => {
                if (message.author.bot) return;
                if (message.channel.id !== channelId) return;
                if (message.content.startsWith('!')) return;
                
                let conversationLog = [
                    { role: 'system', content: 'You are a friendly chatbot.' }
                ];
                
                try {
                    await message.channel.sendTyping();
                    let prevMessages = await message.channel.messages.fetch({ limit: 15 });
                    prevMessages.reverse();
                    
                    prevMessages.forEach((msg) => {
                        if (msg.content.startsWith('!')) return;
                        if (msg.author.id !== client.user.id && msg.author.bot) return;
                        
                        if (msg.author.id === client.user.id) {
                            conversationLog.push({
                                role: 'assistant',
                                content: msg.content,
                                name: msg.author.username
                                    .replace(/\s+/g, '_')
                                    .replace(/[^\w\s]/gi, '')
                            });
                        }
                        
                        if (msg.author.id === message.author.id) {
                            conversationLog.push({
                                role: 'user',
                                content: msg.content,
                                name: message.author.username
                                    .replace(/\s+/g, '_')
                                    .replace(/[^\w\s]/gi, '')
                            });
                        }
                    });
                    
                    const aiResponse = await callPollinationsAPI(conversationLog);
                    await sendChunkedMessage(aiResponse, message.channel);
                    
                } catch (error) {
                    console.error('Error in conversation handler:', error);
                    try {
                        await message.channel.send('Sorry, I encountered an error while processing your message.');
                    } catch (sendError) {
                        console.error('Failed to send error message:', sendError);
                    }
                }
            });
            
            // Don't destroy client in conversation mode - keep it running
            res.json({
                success: true,
                mode: 'conversation',
                model: model,
                jsonMode: jsonMode,
                channelId: channelId,
                botId: client.user.id,
                detail: `Conversational AI bot is now active in channel ${channelId}. Bot will respond to all non-command messages.`
            });
            
        } else if (prompt) {
            // Single prompt mode - process and destroy client
            try {
                const aiResponse = await callPollinationsAPI([
                    { role: 'user', content: prompt }
                ]);
                
                const result = await sendChunkedMessage(aiResponse, channel);
                
                await client.destroy();
                
                res.json({
                    success: true,
                    mode: 'single_prompt',
                    prompt: prompt,
                    model: model,
                    jsonMode: jsonMode,
                    responseLength: aiResponse.length,
                    chunksCount: result.chunks,
                    channelId: channelId,
                    sentMessages: result.sentMessages,
                    detail: `AI response generated and sent to channel. Response was ${aiResponse.length} characters long, split into ${result.chunks} message(s).`
                });
                
            } catch (error) {
                await client.destroy();
                throw error;
            }
        } else {
            await client.destroy();
            return res.status(400).json({
                error: 'Missing prompt or conversation mode',
                detail: 'Please provide a prompt for single response, or set enableConversation to true for conversation mode'
            });
        }
        
    } catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            detail: error.message
        });
    }
});

// Reset AI endpoint - stops conversational bots
app.post('/reset-ai', validateHeaders, async (req, res) => {
    try {
        const { botToken, guildId } = req;
        const channelId = req.headers['x-channel-id'];
        
        if (!channelId) {
            return res.status(400).json({
                error: 'Missing channel ID',
                detail: 'Please provide x-channel-id header'
            });
        }
        
        // Create temporary client to verify access
        const tempClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages
            ]
        });
        
        await tempClient.login(botToken);
        
        // Wait for client to be ready
        await new Promise((resolve) => {
            tempClient.once('ready', resolve);
        });
        
        const guild = await tempClient.guilds.fetch(guildId);
        
        if (!guild) {
            await tempClient.destroy();
            return res.status(404).json({
                error: 'Guild not found',
                detail: 'The specified guild ID could not be found'
            });
        }
        
        const channel = await guild.channels.fetch(channelId);
        
        if (!channel) {
            await tempClient.destroy();
            return res.status(404).json({
                error: 'Channel not found',
                detail: 'The specified channel ID could not be found'
            });
        }
        
        await tempClient.destroy();
        
        // Check if there's an active client for this channel
        const activeClient = activeClients.get(channelId);
        
        if (activeClient) {
            try {
                // Properly destroy the active client
                await activeClient.client.destroy();
                // Remove from tracking
                activeClients.delete(channelId);
                
                res.json({
                    success: true,
                    channelId: channelId,
                    status: 'stopped',
                    detail: `AI bot conversation mode has been stopped and removed for channel ${channelId}.`
                });
            } catch (error) {
                // Even if destroy fails, remove from tracking
                activeClients.delete(channelId);
                
                res.json({
                    success: true,
                    channelId: channelId,
                    status: 'force_stopped',
                    detail: `AI bot conversation mode has been forcefully stopped for channel ${channelId}. There may have been an error during cleanup: ${error.message}`
                });
            }
        } else {
            res.json({
                success: true,
                channelId: channelId,
                status: 'not_active',
                detail: `No active AI bot found for channel ${channelId}. Channel was already inactive.`
            });
        }
        
    } catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            detail: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        detail: err.message
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Discord bot API server running on port ${PORT}`);
    console.log(`Access it at: http://localhost:${PORT}`);
});
