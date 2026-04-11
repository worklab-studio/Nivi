export type Plan = 'starter' | 'pro' | 'agency'
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'skipped'
export type MemoryCategory = 'preference' | 'fact' | 'goal' | 'pattern' | 'avoid'
export type CommentStatus = 'pending' | 'approved' | 'posted' | 'skipped'
export type SourceType = 'transcript' | 'article' | 'post' | 'note' | 'video'
export type ImageType = 'quote' | 'carousel' | 'abstract'

export interface User {
  id: string
  email: string
  name: string
  whatsapp_number: string | null
  whatsapp_opt_in_code: string | null
  unipile_account_id: string | null
  x_account_id: string | null
  plan: Plan
  posting_time: string
  engagement_time: string
  timezone: string
  streak_count: number
  onboarding_step: number
  onboarding_complete: boolean
  stripe_customer_id: string | null
  brand_kit: Record<string, string>
  pending_image_url: string | null
  niche: string | null
  created_at: string
}

export interface ContextFiles {
  id: string
  user_id: string
  writing_style: string | null
  hook_mechanics: string | null
  sentence_styling: string | null
  post_system: string | null
  sample_posts: string | null
  version: number
  updated_at: string
}

export interface KnowledgeChunk {
  id: string
  user_id: string
  source_type: SourceType
  source_title: string | null
  raw_content: string | null
  extracted_insights: string[] | null
  embedding_id: string | null
  created_at: string
}

export interface UserMemory {
  id: string
  user_id: string
  fact: string
  category: MemoryCategory
  confidence: number
  source: string | null
  created_at: string
}

export interface Post {
  id: string
  user_id: string
  content: string
  hook_type: string | null
  content_pillar: number | null
  status: PostStatus
  scheduled_at: string | null
  published_at: string | null
  linkedin_post_id: string | null
  image_url: string | null
  edit_count: number
  created_at: string
  post_analytics?: PostAnalytics[]
}

export interface PostAnalytics {
  id: string
  post_id: string
  impressions: number
  likes: number
  comments: number
  shares: number
  engagement_rate: number
  synced_at: string
}

export interface Conversation {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  message_type: string
  created_at: string
}

export interface ScheduledPost {
  id: string
  post_id: string
  user_id: string
  scheduled_at: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  retry_count: number
  created_at: string
}

export interface CommentOpportunity {
  id: string
  user_id: string
  linkedin_post_id: string
  author_name: string | null
  author_followers: number | null
  post_preview: string | null
  drafted_comment: string | null
  status: CommentStatus
  created_at: string
}
