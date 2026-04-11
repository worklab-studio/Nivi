export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          whatsapp_number: string | null
          whatsapp_opt_in_code: string | null
          unipile_account_id: string | null
          x_account_id: string | null
          plan: 'starter' | 'pro' | 'agency'
          posting_time: string
          engagement_time: string
          timezone: string
          streak_count: number
          onboarding_step: number
          onboarding_complete: boolean
          stripe_customer_id: string | null
          brand_kit: Record<string, unknown>
          pending_image_url: string | null
          niche: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['users']['Row']> & {
          email: string
          name: string
        }
        Update: Partial<Database['public']['Tables']['users']['Row']>
      }
      posts: {
        Row: {
          id: string
          user_id: string
          content: string
          hook_type: string | null
          content_pillar: number | null
          status: 'draft' | 'scheduled' | 'published' | 'skipped'
          scheduled_at: string | null
          published_at: string | null
          linkedin_post_id: string | null
          image_url: string | null
          edit_count: number
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['posts']['Row']> & {
          user_id: string
          content: string
        }
        Update: Partial<Database['public']['Tables']['posts']['Row']>
      }
      post_analytics: {
        Row: {
          id: string
          post_id: string
          impressions: number
          likes: number
          comments: number
          shares: number
          engagement_rate: number
          synced_at: string
        }
        Insert: Partial<Database['public']['Tables']['post_analytics']['Row']> & {
          post_id: string
        }
        Update: Partial<Database['public']['Tables']['post_analytics']['Row']>
      }
    }
  }
}
