$nomention
$httpAddHeader[Content-Type;application/json]
$httpAddHeader[x-bot-token;bot token]
$httpAddHeader[x-guild-id;$guildID]

$httpGet[host url/banlist]

$onlyIf[$httpResult[success]==true;❌ Failed to fetch ban list]

$title[📋 Ban List for $httpResult[guildName]]
$description[Total banned users: **$httpResult[totalBans]**]
$color[FF0000]
$footer[Use the API directly for detailed user information]
