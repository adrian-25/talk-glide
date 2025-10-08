import { useEffect, useState } from "react";
import { User, MessageCircle, Users, LogOut, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  other_user?: {
    username: string;
    display_name: string | null;
  };
  last_message?: string;
}

interface ChatSidebarProps {
  currentUserId: string;
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
}

export const ChatSidebar = ({
  currentUserId,
  selectedConversationId,
  onSelectConversation,
  onNewChat,
  onNewGroup,
}: ChatSidebarProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadCurrentUser();
    loadConversations();

    const conversationsChannel = supabase
      .channel("conversations-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
    };
  }, [currentUserId]);

  const loadCurrentUser = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUserId)
      .single();
    setCurrentUser(data);
  };

  const loadConversations = async () => {
    const { data: memberData } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", currentUserId);

    if (!memberData || memberData.length === 0) {
      setConversations([]);
      return;
    }

    const conversationIds = memberData.map((m) => m.conversation_id);

    const { data: convData } = await supabase
      .from("conversations")
      .select("*")
      .in("id", conversationIds)
      .order("updated_at", { ascending: false });

    if (convData) {
      const conversationsWithDetails = await Promise.all(
        convData.map(async (conv) => {
          if (!conv.is_group) {
            const { data: members } = await supabase
              .from("conversation_members")
              .select("user_id")
              .eq("conversation_id", conv.id)
              .neq("user_id", currentUserId);

            if (members && members.length > 0) {
              const { data: otherUser } = await supabase
                .from("profiles")
                .select("username, display_name")
                .eq("id", members[0].user_id)
                .single();

              return {
                ...conv,
                other_user: otherUser,
              };
            }
          }
          return conv;
        })
      );

      setConversations(conversationsWithDetails);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  const getConversationName = (conv: Conversation) => {
    if (conv.is_group) {
      return conv.name || "Unnamed Group";
    }
    return conv.other_user?.display_name || conv.other_user?.username || "Unknown User";
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex h-full w-full flex-col border-r bg-sidebar">
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 bg-primary">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {currentUser?.display_name ? getInitials(currentUser.display_name) : <User className="h-5 w-5" />}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{currentUser?.display_name || currentUser?.username}</span>
            <span className="text-xs text-muted-foreground">Online</span>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-2 p-2 border-b">
        <Button onClick={onNewChat} className="flex-1" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
        <Button onClick={onNewGroup} variant="secondary" className="flex-1" size="sm">
          <Users className="mr-2 h-4 w-4" />
          New Group
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
              <p className="text-xs text-muted-foreground mt-1">Start a new chat or create a group</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full rounded-lg p-3 text-left transition-colors hover:bg-sidebar-hover ${
                  selectedConversationId === conv.id ? "bg-sidebar-accent" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {conv.is_group ? (
                        <Users className="h-5 w-5" />
                      ) : (
                        getInitials(getConversationName(conv))
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium">{getConversationName(conv)}</p>
                    {conv.last_message && (
                      <p className="truncate text-xs text-muted-foreground">{conv.last_message}</p>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
