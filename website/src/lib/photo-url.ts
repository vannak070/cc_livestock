/** The address of a snapshot photo (served by src/app/photos/[file]/route.ts). */
export const photoUrl = (id: string, size: 'small' | 'large' = 'large') => `/photos/${id}-${size}`;
