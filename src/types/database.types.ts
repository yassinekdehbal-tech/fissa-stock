export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      intervention_parts: {
        Row: {
          created_at: string
          id: string
          intervention_id: string
          name: string | null
          piece_id: string | null
          prix_unitaire: number
          qty: number
          ref: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          intervention_id: string
          name?: string | null
          piece_id?: string | null
          prix_unitaire?: number
          qty?: number
          ref?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          intervention_id?: string
          name?: string | null
          piece_id?: string | null
          prix_unitaire?: number
          qty?: number
          ref?: string | null
        }
        Relationships: []
      }
      interventions: {
        Row: {
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_by: string | null
          date_created: string
          date_done: string | null
          date_scheduled: string | null
          description: string | null
          estimated_total: number
          id: string
          invoice_id: string | null
          notes: string | null
          status: Database['public']['Enums']['intervention_status']
          updated_at: string
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_by?: string | null
          date_created?: string
          date_done?: string | null
          date_scheduled?: string | null
          description?: string | null
          estimated_total?: number
          id?: string
          invoice_id?: string | null
          notes?: string | null
          status?: Database['public']['Enums']['intervention_status']
          updated_at?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_by?: string | null
          date_created?: string
          date_done?: string | null
          date_scheduled?: string | null
          description?: string | null
          estimated_total?: number
          id?: string
          invoice_id?: string | null
          notes?: string | null
          status?: Database['public']['Enums']['intervention_status']
          updated_at?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          client_address: string | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_by: string | null
          date_issued: string
          id: string
          intervention_id: string | null
          notes: string | null
          number: string | null
          status: Database['public']['Enums']['invoice_status']
          total_ht: number
          total_ttc: number
          total_tva: number
          tva_rate: number
          type: Database['public']['Enums']['invoice_type']
          updated_at: string
        }
        Insert: {
          id?: string
          number?: string | null
          type?: Database['public']['Enums']['invoice_type']
          status?: Database['public']['Enums']['invoice_status']
          intervention_id?: string | null
          client_name?: string | null
          client_address?: string | null
          client_phone?: string | null
          client_email?: string | null
          total_ht?: number
          tva_rate?: number
          total_tva?: number
          total_ttc?: number
          notes?: string | null
          date_issued?: string
          created_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          number?: string | null
          type?: Database['public']['Enums']['invoice_type']
          status?: Database['public']['Enums']['invoice_status']
          intervention_id?: string | null
          client_name?: string | null
          client_address?: string | null
          client_phone?: string | null
          client_email?: string | null
          total_ht?: number
          tva_rate?: number
          total_tva?: number
          total_ttc?: number
          notes?: string | null
          date_issued?: string
          created_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoice_lines: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          kind: string
          label: string
          piece_id: string | null
          qty: number
          tva_rate: number
          unit_price_ht: number
        }
        Insert: {
          id?: string
          invoice_id: string
          label: string
          kind?: string
          piece_id?: string | null
          qty?: number
          unit_price_ht?: number
          tva_rate?: number
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          label?: string
          kind?: string
          piece_id?: string | null
          qty?: number
          unit_price_ht?: number
          tva_rate?: number
          created_at?: string
        }
        Relationships: []
      }
      pieces: {
        Row: {
          added: string
          archived: boolean
          cat: Database['public']['Enums']['piece_category'] | null
          compat: string | null
          cost_price: number | null
          created_by: string | null
          donor: string | null
          etat: Database['public']['Enums']['piece_state'] | null
          fmt: Database['public']['Enums']['barcode_format']
          id: string
          name: string
          notes: string | null
          oem: string | null
          photo: string | null
          price: number
          publishable: boolean
          qty: number
          ref: string
          supplier: string | null
          threshold: number | null
          updated_at: string
          vehicle: string | null
          zone: string | null
        }
        Insert: {
          added?: string
          archived?: boolean
          cat?: Database['public']['Enums']['piece_category'] | null
          compat?: string | null
          cost_price?: number | null
          created_by?: string | null
          donor?: string | null
          etat?: Database['public']['Enums']['piece_state'] | null
          fmt?: Database['public']['Enums']['barcode_format']
          id?: string
          name: string
          notes?: string | null
          oem?: string | null
          photo?: string | null
          price?: number
          publishable?: boolean
          qty?: number
          ref: string
          supplier?: string | null
          threshold?: number | null
          updated_at?: string
          vehicle?: string | null
          zone?: string | null
        }
        Update: {
          added?: string
          archived?: boolean
          cat?: Database['public']['Enums']['piece_category'] | null
          compat?: string | null
          cost_price?: number | null
          created_by?: string | null
          donor?: string | null
          etat?: Database['public']['Enums']['piece_state'] | null
          fmt?: Database['public']['Enums']['barcode_format']
          id?: string
          name?: string
          notes?: string | null
          oem?: string | null
          photo?: string | null
          price?: number
          publishable?: boolean
          qty?: number
          ref?: string
          supplier?: string | null
          threshold?: number | null
          updated_at?: string
          vehicle?: string | null
          zone?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string | null
          perm_historique: boolean
          perm_magasinier: boolean
          perm_vendeur: boolean
          role: Database['public']['Enums']['user_role']
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id: string
          name?: string | null
          perm_historique?: boolean
          perm_magasinier?: boolean
          perm_vendeur?: boolean
          role?: Database['public']['Enums']['user_role']
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          perm_historique?: boolean
          perm_magasinier?: boolean
          perm_vendeur?: boolean
          role?: Database['public']['Enums']['user_role']
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      publications: {
        Row: {
          channel_id: string
          date_published: string | null
          error_msg: string | null
          external_id: string | null
          id: string
          piece_id: string
          status: Database['public']['Enums']['publication_status']
          updated_at: string
          url: string | null
        }
        Insert: {
          channel_id: string
          date_published?: string | null
          error_msg?: string | null
          external_id?: string | null
          id?: string
          piece_id: string
          status?: Database['public']['Enums']['publication_status']
          updated_at?: string
          url?: string | null
        }
        Update: {
          channel_id?: string
          date_published?: string | null
          error_msg?: string | null
          external_id?: string | null
          id?: string
          piece_id?: string
          status?: Database['public']['Enums']['publication_status']
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          name: string | null
          piece_id: string | null
          prix_unitaire: number
          qty: number
          ref: string | null
          sale_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          piece_id?: string | null
          prix_unitaire?: number
          qty?: number
          ref?: string | null
          sale_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          piece_id?: string | null
          prix_unitaire?: number
          qty?: number
          ref?: string | null
          sale_id?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          client: string | null
          created_at: string
          discount: number
          id: string
          payment: Database['public']['Enums']['payment_method'] | null
          total: number
          user_id: string | null
        }
        Insert: {
          client?: string | null
          created_at?: string
          discount?: number
          id?: string
          payment?: Database['public']['Enums']['payment_method'] | null
          total?: number
          user_id?: string | null
        }
        Update: {
          client?: string | null
          created_at?: string
          discount?: number
          id?: string
          payment?: Database['public']['Enums']['payment_method'] | null
          total?: number
          user_id?: string | null
        }
        Relationships: []
      }
      sales_channels: {
        Row: {
          active: boolean
          config: Json
          created_at: string
          id: string
          integration: Database['public']['Enums']['channel_integration']
          key: Database['public']['Enums']['channel_key']
          label: string
        }
        Insert: {
          active?: boolean
          config?: Json
          created_at?: string
          id?: string
          integration?: Database['public']['Enums']['channel_integration']
          key: Database['public']['Enums']['channel_key']
          label: string
        }
        Update: {
          active?: boolean
          config?: Json
          created_at?: string
          id?: string
          integration?: Database['public']['Enums']['channel_integration']
          key?: Database['public']['Enums']['channel_key']
          label?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          channel: Database['public']['Enums']['channel_key'] | null
          created_at: string
          id: string
          intervention_id: string | null
          name: string | null
          note: string | null
          piece_id: string | null
          prix: number | null
          qty_delta: number
          ref: string | null
          type: Database['public']['Enums']['movement_type']
          user_id: string | null
        }
        Insert: {
          channel?: Database['public']['Enums']['channel_key'] | null
          created_at?: string
          id?: string
          intervention_id?: string | null
          name?: string | null
          note?: string | null
          piece_id?: string | null
          prix?: number | null
          qty_delta: number
          ref?: string | null
          type: Database['public']['Enums']['movement_type']
          user_id?: string | null
        }
        Update: {
          channel?: Database['public']['Enums']['channel_key'] | null
          created_at?: string
          id?: string
          intervention_id?: string | null
          name?: string | null
          note?: string | null
          piece_id?: string | null
          prix?: number | null
          qty_delta?: number
          ref?: string | null
          type?: Database['public']['Enums']['movement_type']
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      add_intervention_part: {
        Args: {
          p_intervention: string
          p_piece: string
          p_prix?: number
          p_qty: number
        }
        Returns: string
      }
      has_perm: { Args: { p: string }; Returns: boolean }
      is_admin: { Args: Record<never, never>; Returns: boolean }
      mark_piece_sold: {
        Args: {
          p_channel?: Database['public']['Enums']['channel_key']
          p_piece: string
          p_prix?: number
        }
        Returns: undefined
      }
      remove_intervention_part: { Args: { p_part: string }; Returns: undefined }
    }
    Enums: {
      barcode_format: 'CODE128' | 'CODE39'
      channel_integration: 'api' | 'connector' | 'manual'
      channel_key: 'leboncoin' | 'ebay' | 'ovoko' | 'autre'
      intervention_status: 'todo' | 'in_progress' | 'done'
      invoice_status: 'brouillon' | 'envoye' | 'paye' | 'annule'
      invoice_type: 'devis' | 'facture'
      movement_type:
        | 'ajout'
        | 'vente-comptoir'
        | 'sortie-chantier'
        | 'retour-chantier'
        | 'vente-marketplace'
        | 'ajustement'
        | 'archivage'
      payment_method: 'especes' | 'carte' | 'virement' | 'cheque'
      piece_category:
        | 'moteur'
        | 'carrosserie'
        | 'train-avant'
        | 'train-arriere'
        | 'electronique'
        | 'autre'
      piece_state: 'Bon état' | 'Très bon état' | 'État moyen' | 'Pour pièces'
      publication_status: 'draft' | 'published' | 'sold' | 'error' | 'delisted'
      user_role: 'admin' | 'user'
    }
    CompositeTypes: Record<never, never>
  }
}
