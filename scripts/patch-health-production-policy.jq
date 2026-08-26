.Statement |= map(
  if .Effect == "Allow" and
     ((.Resource | if type == "array" then . else [.] end) | index($resource)) != null and
     ((.Action | if type == "array" then . else [.] end) | index("cloudformation:UpdateStack")) != null
  then .Action = (((.Action | if type == "array" then . else [.] end) + [$action]) | unique)
  else .
  end
) |
.Statement = ((.Statement | map(select(.Sid != $evidence_secret.Sid))) + [$evidence_secret])
