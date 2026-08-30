UPDATE "organization_usage"
SET
	"chat_credits_included" = CEIL("chat_credits_included"::numeric / 1000)::bigint,
	"chat_credits_used" = CEIL("chat_credits_used"::numeric / 1000)::bigint,
	"stripe_chat_credits_reported" = 0;
