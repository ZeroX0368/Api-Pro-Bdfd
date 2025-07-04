$nomention
$httpAddHeader[Content-Type;application/json]
$httpAddHeader[x-bot-token;bot token]
$httpAddHeader[x-guild-id;$guildID]

$httpGet[host url/guild/membercount]

$onlyIf[$httpResult[success]==true;❌ Failed to fetch member count]

**👥 Member Count for $httpResult[guildName]**
👤 Users: **$httpResult[count;users]**
🤖 Bots: **$httpResult[count;bots]**
📊 Total: **$httpResult[count;total]**
