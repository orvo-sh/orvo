ALTER TABLE "chat_message" DROP CONSTRAINT "chat_message_pkey";--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_chat_id_id_pk" PRIMARY KEY("chat_id","id");
