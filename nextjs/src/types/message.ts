export type MessageFilter = {
    source?: string;
    event_type?: string;
    is_read?: boolean | 'all';
    start_date?: string;
    end_date?: string;
    search?: string;
    page?: number;
    page_size?: number;
};

export type ExternalMessage = {
    id: number;
    source: string;
    event_type: string;
    event_id: string;
    payload: any;
    is_read: boolean;
    notes: string | null;
    received_at: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
};

export type MessageListResponse = {
    data: ExternalMessage[];
    total: number;
    page: number;
    page_size: number;
};

export type BatchMessageAction = 'mark_read' | 'mark_unread' | 'delete';

export type BatchMessageRequest = {
    action: BatchMessageAction;
    ids: number[];
};

export type ForwardMessageRequest = {
    message_id: number;
    user_ids: string[];
};

export type PushMessageRequest = {
    message_id: number;
};
