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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
}

interface NewGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  onGroupCreated: (conversationId: string) => void;
}

export const NewGroupDialog = ({
  open,
  onOpenChange,
  currentUserId,
  onGroupCreated,
}: NewGroupDialogProps) => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadUsers();
      setSelectedUsers([]);
      setGroupName("");
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

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    if (selectedUsers.length < 1) {
      toast.error("Please select at least one user");
      return;
    }

    setLoading(true);
    try {
      const { data: newConversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          name: groupName.trim(),
          is_group: true,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (convError) throw convError;

      const members = [
        { conversation_id: newConversation.id, user_id: currentUserId },
        ...selectedUsers.map((userId) => ({
          conversation_id: newConversation.id,
          user_id: userId,
        })),
      ];

      const { error: membersError } = await supabase
        .from("conversation_members")
        .insert(members);

      if (membersError) throw membersError;

      toast.success("Group created successfully!");
      onGroupCreated(newConversation.id);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Group</DialogTitle>
          <DialogDescription>
            Create a new group chat with multiple users
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Group Name</Label>
            <Input
              id="group-name"
              placeholder="Enter group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Select Members</Label>
            <ScrollArea className="h-[200px] rounded-md border p-2">
              <div className="space-y-2">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent"
                  >
                    <Checkbox
                      id={user.id}
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={() => toggleUser(user.id)}
                    />
                    <label
                      htmlFor={user.id}
                      className="flex flex-1 items-center gap-3 cursor-pointer"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {user.display_name ? getInitials(user.display_name) : <User className="h-4 w-4" />}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {user.display_name || user.username}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          @{user.username}
                        </p>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <p className="text-xs text-muted-foreground">
              {selectedUsers.length} user(s) selected
            </p>
          </div>
          <Button
            onClick={handleCreateGroup}
            disabled={loading || !groupName.trim() || selectedUsers.length === 0}
            className="w-full"
          >
            {loading ? "Creating..." : "Create Group"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
