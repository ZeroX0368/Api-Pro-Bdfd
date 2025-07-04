$nomention
$httpAddHeader[Content-Type;application/json]
$httpAddHeader[x-bot-token;bot token]
$httpAddHeader[x-guild-id;$guildID]
$httpAddHeader[x-channel-id;$channelID]
$httpPost[host url/reset-ai]
$httpResult
