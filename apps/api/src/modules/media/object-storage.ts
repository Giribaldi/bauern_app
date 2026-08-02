export interface ObjectStorage {
  createUploadUrl(input: {
    key: string
    contentType: string
    expiresInSeconds: number
  }): Promise<{ uploadUrl: string; publicUrl: string }>
  deleteObject(key: string): Promise<void>
}

export const validatePublicImageUrl = (value: string): string => {
  const url = new URL(value)
  if (url.protocol !== 'https:') throw new Error('A public image URL must use HTTPS.')
  return url.toString()
}
