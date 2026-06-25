/**
 * app/(main)/collab/[roomId]/page.tsx
 *
 * Next.js App Router page — must be a default export.
 * We keep this file thin: just a Suspense boundary + the actual page component.
 * 
 * 'use client' goes here (not just in the hook) so Next.js knows the whole
 * tree is client-only and doesn't try to SSR any of the WebRTC/Yjs code.
 */
'use client';

import React, { Suspense } from 'react';
import CollabPage from '@/components/collab/CollabPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CollabPage />
    </Suspense>
  );
}