.Statement |= map(
  if .Effect == "Allow" and
     ((.Resource | if type == "array" then . else [.] end) | index($resource)) != null and
     ((.Action | if type == "array" then . else [.] end) | index("cloudformation:UpdateStack")) != null
  then .Action = (((.Action | if type == "array" then . else [.] end) + [$action]) | unique)
  else .
  end
) |
# Remove only the obsolete Allow. Existing Deny statements must survive recovery.
.Statement |= map(select(.Effect != "Allow" or .Sid != "ManageEvidenceDatabaseSecret")) |
if any(.Statement[]; . == $rds_deny) then .
elif any(.Statement[]; .Sid == $rds_deny.Sid) then
  error("Existing RDS retirement policy differs; inspect it before recovery")
else .Statement += [$rds_deny]
end
