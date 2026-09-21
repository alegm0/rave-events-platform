// Firebase Storage helper for image uploads
// Replaces base64 data URLs with actual Storage URLs
// Uses the free tier: 5GB storage, 1GB/day download

import { storage } from '../firebase/config'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

/**
 * Upload an image file to Firebase Storage
 * @param {File} file - The image file to upload
 * @param {string} path - Storage path (e.g., 'events/ev123', 'brands/org123/logo')
 * @returns {Promise<string>} The public download URL
 */
export const uploadImage = async (file, path) => {
  if (!file) throw new Error('No file provided')

  // Validate file
  if (!file.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen')
  if (file.size > 5 * 1024 * 1024) throw new Error('La imagen no puede superar 5MB')

  // Create a unique filename
  const ext = file.name.split('.').pop() || 'jpg'
  const filename = `${path}/${Date.now()}_${Math.random().toString(36).substr(2, 8)}.${ext}`

  const storageRef = ref(storage, filename)
  const snapshot = await uploadBytes(storageRef, file)
  const url = await getDownloadURL(snapshot.ref)
  return url
}

/**
 * Upload a base64 data URL to Firebase Storage (for migration/compat)
 * @param {string} dataUrl - The base64 data URL
 * @param {string} path - Storage path
 * @returns {Promise<string>} The public download URL
 */
export const uploadBase64Image = async (dataUrl, path) => {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl // Return as-is if it's already a URL

  // Convert base64 to blob
  const res = await fetch(dataUrl)
  const blob = await res.blob()

  if (blob.size > 5 * 1024 * 1024) throw new Error('La imagen no puede superar 5MB')

  const ext = blob.type.split('/')[1] || 'jpg'
  const filename = `${path}/${Date.now()}_${Math.random().toString(36).substr(2, 8)}.${ext}`

  const storageRef = ref(storage, filename)
  const snapshot = await uploadBytes(storageRef, blob)
  const url = await getDownloadURL(snapshot.ref)
  return url
}

/**
 * Check if a string is a base64 data URL (not a real URL)
 */
export const isBase64 = (str) => str && str.startsWith('data:')
