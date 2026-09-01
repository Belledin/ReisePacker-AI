-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Table: trips
create table public.trips (
    id uuid primary key default uuid_generate_v4(),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    destination text not null,
    start_date date not null,
    end_date date not null,
    weather_snapshot jsonb, -- Stores { rainProbability, minTemp } at time of creation
    transport_limit integer not null, -- grams
    mode text not null check (mode in ('SHARED', 'INDEPENDENT')),
    is_template boolean default false -- For "saved as template" feature
);

-- Table: travelers
create table public.travelers (
    id uuid primary key default uuid_generate_v4(),
    trip_id uuid references public.trips(id) on delete cascade not null,
    name text not null,
    type text not null check (type in ('ADULT', 'TEEN', 'CHILD', 'TODDLER')),
    current_load integer default 0,
    max_load integer default 0
);

-- Table: packing_items
create table public.packing_items (
    id uuid primary key default uuid_generate_v4(),
    trip_id uuid references public.trips(id) on delete cascade not null,
    
    -- Owner can be specific person OR null (for community box)
    owner_id uuid references public.travelers(id) on delete set null,
    is_community_item boolean default false, 

    item_id text not null, -- The 'id' from PackingEngine (e.g. 'toothpaste')
    name text not null,
    category text not null,
    weight integer not null,
    tags text[],
    
    is_packed boolean default false,
    quantity integer default 1
);

-- Indexes
create index idx_trips_created_at on public.trips(created_at desc);
create index idx_travelers_trip_id on public.travelers(trip_id);
create index idx_packing_items_trip_id on public.packing_items(trip_id);
create index idx_packing_items_owner_id on public.packing_items(owner_id);
