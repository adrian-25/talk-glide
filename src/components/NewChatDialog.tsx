import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
}

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  onChatCreated: (conversationId: string) => void;
}

export const NewChatDialog = ({
  open,
  onOpenChange,
  currentUserId,
  onChatCreated,
}: NewChatDialogProps) => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadUsers();
    }
  }, [open]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", currentUserId);

    if (data) {
      setUsers(data);
    }
  };

  const handleCreateChat = async (otherUserId: string) => {
    setLoading(true);
    try {
      const { data: existingConversations } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", currentUserId);

      if (existingConversations) {
        for (const conv of existingConversations) {
          const { data: members } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", conv.conversation_id);

          if (
            members &&
            members.length === 2 &&
            members.some((m) => m.user_id === otherUserId)
          ) {
            toast.info("Conversation already exists");
            onChatCreated(conv.conversation_id);
            onOpenChange(false);
            return;
          }
        }
      }

      const { data: newConversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          is_group: false,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (convError) throw convError;

      const { error: membersError } = await supabase
        .from("conversation_members")
        .insert([
          { conversation_id: newConversation.id, user_id: currentUserId },
          { conversation_id: newConversation.id, user_id: otherUserId },
        ]);

      if (membersError) throw membersError;

      toast.success("Chat created successfully!");
      onChatCreated(newConversation.id);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to create chat");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Chat</DialogTitle>
          <DialogDescription>Select a user to start chatting</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {filteredUsers.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No users found
                </p>
              ) : (
                filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleCreateChat(user.id)}
                    disabled={loading}
                    className="flex w-full items-center gap-3 rounded-lg p-3 hover:bg-accent transition-colors"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {user.display_name ? getInitials(user.display_name) : <User className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="font-medium">{user.display_name || user.username}</p>
                      <p className="text-sm text-muted-foreground">@{user.username}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
