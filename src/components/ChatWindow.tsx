import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  sender?: {
    username: string;
    display_name: string | null;
  };
}

interface ChatWindowProps {
  conversationId: string | null;
  currentUserId: string;
}

export const ChatWindow = ({ conversationId, currentUserId }: ChatWindowProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [conversationInfo, setConversationInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setConversationInfo(null);
      return;
    }

    loadConversationInfo();
    loadMessages();

    const messagesChannel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const loadConversationInfo = async () => {
    if (!conversationId) return;

    const { data } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (data && !data.is_group) {
      const { data: members } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId)
        .neq("user_id", currentUserId);

      if (members && members.length > 0) {
        const { data: otherUser } = await supabase
          .from("profiles")
          .select("username, display_name")
          .eq("id", members[0].user_id)
          .single();

        setConversationInfo({
          ...data,
          other_user: otherUser,
        });
      }
    } else {
      setConversationInfo(data);
    }
  };

  const loadMessages = async () => {
    if (!conversationId) return;

    const { data } = await supabase
      .from("messages")
      .select(
        `
        *,
        sender:profiles!messages_sender_id_fkey(username, display_name)
      `
      )
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (data) {
      setMessages(data);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversationId || loading) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: newMessage.trim(),
      });

      if (error) throw error;

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      setNewMessage("");
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const getConversationName = () => {
    if (!conversationInfo) return "";
    if (conversationInfo.is_group) {
      return conversationInfo.name || "Unnamed Group";
    }
    return conversationInfo.other_user?.display_name || conversationInfo.other_user?.username || "Unknown User";
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!conversationId) {
    return (
      <div className="flex h-full items-center justify-center bg-[hsl(var(--chat-bg))]">
        <div className="text-center">
          <Users className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Welcome to TalkGlide</h2>
          <p className="text-muted-foreground">Select a conversation or start a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--chat-bg))]">
      <div className="flex items-center gap-3 border-b bg-card p-4">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-primary/10 text-primary">
            {conversationInfo?.is_group ? (
              <Users className="h-5 w-5" />
            ) : (
              getInitials(getConversationName())
            )}
          </AvatarFallback>
        </Avatar>
        <div>
          <h2 className="font-semibold">{getConversationName()}</h2>
          <p className="text-xs text-muted-foreground">
            {conversationInfo?.is_group ? "Group Chat" : "Online"}
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => {
            const isSent = message.sender_id === currentUserId;
            return (
              <div
                key={message.id}
                className={`flex ${isSent ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    isSent
                      ? "bg-[hsl(var(--message-sent))] text-foreground"
                      : "bg-[hsl(var(--message-received))] text-foreground"
                  }`}
                >
                  {!isSent && conversationInfo?.is_group && (
                    <p className="text-xs font-semibold text-primary mb-1">
                      {message.sender?.display_name || message.sender?.username}
                    </p>
                  )}
                  <p className="break-words">{message.content}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(message.created_at), "HH:mm")}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <form onSubmit={handleSendMessage} className="border-t bg-card p-4">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={loading || !newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};
