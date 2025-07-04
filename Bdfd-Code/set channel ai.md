$nomention
$httpAddHeader[Content-Type;application/json]
$httpAddHeader[x-bot-token;Bot token]
$httpAddHeader[x-guild-id;$guildID]
$httpAddHeader[x-channel-id;$channelID]

$httpPost[host url;{
"enableConversation": true,
"model": "openai"
}]
$httpResult
