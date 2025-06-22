$nomention
$onlyIf[$checkContains[$authorID;YOUR_ADMIN_USER_ID]==true;You don't have permission to use this command!]

$var[roleId;$findrole[$message]]
$onlyIf[$var[roleId]!=;Please provide a role ID!]

$httpAddHeader[Content-Type;application/json]
$httpAddHeader[x-bot-token;$getBotToken]
$httpAddHeader[x-guild-id;$guildID]

$httpPost[https://YOUR-Api/addroleall;{
"roleId": "$var[roleId]"
}]

$if[$httpStatus==200]
✅ **Success!**
$httpResult[detail]

**Stats:**
• Total Members: $httpResult[totalMembers]
• Successfully Added: $httpResult[successCount]
• Already Had Role: $httpResult[skipCount]
• Errors: $httpResult[errorCount]
$else
❌ **Error:** $httpResult[error]
$httpResult[detail]
$endif
