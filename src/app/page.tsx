'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { League } from '@/lib/types';

export default function HomePage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/leagues')
      .then((r) => r.json())
      .then((data) => {
        setLeagues(Array.isArray(data) ? data : []);
      })
      .catch(() => setLeagues([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cricket Leagues</h1>
          <p className="text-muted-foreground mt-1">Browse leagues or create your own</p>
        </div>
        <Button
          onClick={() => router.push('/leagues/new')}
          className="bg-green-700 hover:bg-green-600 text-white"
        >
          + Create League
        </Button>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {!loading && leagues.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <span className="text-7xl">🏏</span>
          <h2 className="text-xl font-semibold text-foreground">No leagues yet</h2>
          <p className="text-muted-foreground text-center max-w-xs">
            Be the first to create a cricket league and start adding player cards!
          </p>
          <Button
            onClick={() => router.push('/leagues/new')}
            className="bg-green-700 hover:bg-green-600 text-white mt-2"
          >
            Create the First League
          </Button>
        </div>
      )}

      {!loading && leagues.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {leagues.map((league) => (
            <Card
              key={league.id}
              className="cursor-pointer border border-border hover:border-green-500 hover:shadow-lg transition-all duration-200 group"
              onClick={() => router.push(`/leagues/${league.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg group-hover:text-green-700 transition-colors line-clamp-2">
                    {league.name}
                  </CardTitle>
                  <Badge variant="secondary" className="shrink-0 bg-green-100 text-green-800">
                    {league.totalPlayers} players
                  </Badge>
                </div>
                <CardDescription>Conducted by {league.conductedBy}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(league.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
