/** The address of a snapshot photo (served by src/app/photos/[file]/route.ts; resized for each screen by next/image). */
export const photoUrl = (id: string, size: 'small' | 'large' = 'large') => `/photos/${id}-${size}`;
