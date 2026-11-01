// Types for the ClubPredict schema in supabase/migrations, in the format
// produced by `supabase gen types typescript`. Regenerate with the CLI once a
// project is linked, and keep this file in sync with migrations.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type TournamentRole = 'member' | 'organizer';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string; created_at: string; updated_at: string };
        Insert: { id: string; display_name: string; created_at?: string; updated_at?: string };
        Update: { display_name?: string };
        Relationships: [];
      };
      tournaments: {
        Row: {
          id: string;
          name: string;
          venue: string | null;
          starts_on: string;
          ends_on: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          venue?: string | null;
          starts_on: string;
          ends_on: string;
          created_by?: string | null;
        };
        Update: { name?: string; venue?: string | null; starts_on?: string; ends_on?: string };
        Relationships: [];
      };
      tournament_invites: {
        Row: {
          id: string;
          tournament_id: string;
          code: string;
          active: boolean;
          expires_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      tournament_members: {
        Row: { tournament_id: string; user_id: string; role: TournamentRole; joined_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          tournament_id: string;
          name: string;
          seed: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { id?: string; tournament_id: string; name: string; seed?: number | null };
        Update: { name?: string; seed?: number | null };
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          tournament_id: string;
          round: string;
          court: string | null;
          scheduled_at: string;
          best_of: number;
          player_a_id: string;
          player_b_id: string;
          winner_id: string | null;
          result_sets: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          round: string;
          court?: string | null;
          scheduled_at: string;
          best_of?: number;
          player_a_id: string;
          player_b_id: string;
          winner_id?: string | null;
          result_sets?: Json | null;
        };
        Update: {
          round?: string;
          court?: string | null;
          scheduled_at?: string;
          best_of?: number;
          winner_id?: string | null;
          result_sets?: Json | null;
        };
        Relationships: [];
      };
      predictions: {
        Row: {
          id: string;
          match_id: string;
          user_id: string;
          winner_id: string;
          sets: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: { match_id: string; user_id: string; winner_id: string; sets: Json };
        Update: { match_id?: string; user_id?: string; winner_id?: string; sets?: Json };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      join_tournament: { Args: { invite_code: string }; Returns: string };
    };
    Enums: { tournament_role: TournamentRole };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
