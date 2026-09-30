import type { Message, Profile } from '../data/types';

export type DatingMatch = Profile & {
  matchedAt: string;
  lastMessage: string | null;
  unread: number;
};

export type DatingPreferences = {
  answers: Record<string, string>;
  completed: boolean;
};

export type PersonalDatingProfile = {
  name: string;
  age: number;
  headline: string;
  bio: string;
  song: string;
  interests: string[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

export async function fetchDatingProfiles(): Promise<Profile[]> {
  return (await request<{ profiles: Profile[] }>('/api/dating/profiles')).profiles;
}

export async function fetchDatingProfile(id: string): Promise<Profile> {
  return (await request<{ profile: Profile }>(`/api/dating/profiles/${encodeURIComponent(id)}`)).profile;
}

export async function submitDatingSwipe(profileId: string, action: 'like' | 'pass'): Promise<{ matched: boolean }> {
  return request('/api/dating/swipes', {
    method: 'POST',
    body: JSON.stringify({ profileId, action }),
  });
}

export async function fetchDatingMatches(): Promise<DatingMatch[]> {
  return (await request<{ matches: DatingMatch[] }>('/api/dating/matches')).matches;
}

export async function fetchDatingMessages(profileId: string): Promise<Message[]> {
  return (await request<{ messages: Message[] }>(`/api/dating/matches/${encodeURIComponent(profileId)}/messages`)).messages;
}

export async function sendDatingMessage(profileId: string, text: string): Promise<Message> {
  return (await request<{ message: Message }>(`/api/dating/matches/${encodeURIComponent(profileId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })).message;
}

export async function fetchDatingPreferences(): Promise<DatingPreferences> {
  return request('/api/dating/preferences');
}

export async function saveDatingPreferences(answers: Record<string, string>): Promise<DatingPreferences> {
  return request('/api/dating/preferences', {
    method: 'PUT',
    body: JSON.stringify({ answers }),
  });
}

export async function fetchMyDatingProfile(): Promise<PersonalDatingProfile> {
  return (await request<{ profile: PersonalDatingProfile }>('/api/dating/profile')).profile;
}

export async function updateMyDatingProfile(profile: PersonalDatingProfile): Promise<PersonalDatingProfile> {
  return (await request<{ profile: PersonalDatingProfile }>('/api/dating/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  })).profile;
}

