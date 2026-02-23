import { useState, useEffect } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import api from '../services/api'
import { toast } from '../services/toastService'

const BannerForm = ({ banner, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    status: 'active',
  })

  const [attachment, setAttachment] = useState(null)
  const [attachmentPreview, setAttachmentPreview] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (banner) {
      setFormData({
        name: banner.name || '',
        status: banner.status || 'active',
      })
      if (banner.attachment) {
        setAttachmentPreview(banner.attachment)
      }
    } else {
      setFormData({
        name: '',
        status: 'active',
      })
      setAttachment(null)
      setAttachmentPreview(null)
      setPendingFile(null)
    }
  }, [banner])

  const validate = () => {
    const newErrors = {}
    if (!formData.name || !formData.name.trim()) {
      newErrors.name = 'Banner name is required'
    }
    if (!attachment && !attachmentPreview && !pendingFile) {
      newErrors.attachment = 'Banner attachment is required'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type (images only)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      toast.error('Error', 'Please upload a valid image file (JPEG, PNG, WebP, or GIF)')
      return
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      toast.error('Error', 'File size must be less than 10MB')
      return
    }

    // If editing existing banner, upload immediately
    if (banner && (banner._id || banner.id)) {
      setUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('entityType', 'banner')
        formData.append('entityId', banner._id || banner.id)
        formData.append('documentType', 'banner_image')
        formData.append('description', 'Banner image')

        const uploadResponse = await api.documents.upload(formData)
        const document = uploadResponse.data || uploadResponse

        const fileUrl = document.url || document.filePath || document.attachment

        if (fileUrl) {
          setAttachment({
            url: fileUrl,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          })
          setAttachmentPreview(fileUrl)
          setPendingFile(null)
          toast.success('Success', 'File uploaded successfully')
        } else {
          throw new Error('Failed to get file URL from upload response')
        }
      } catch (error) {
        console.error('File upload error:', error)
        toast.error('Upload Failed', error.message || 'Failed to upload file')
      } finally {
        setUploading(false)
      }
    } else {
      // For new banners, store file temporarily and create preview
      setPendingFile(file)
      const previewUrl = URL.createObjectURL(file)
      setAttachmentPreview(previewUrl)
      setAttachment({
        url: previewUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        isPending: true,
      })
    }
  }

  const handleRemoveAttachment = () => {
    setAttachment(null)
    setAttachmentPreview(null)
    setPendingFile(null)
    // Clean up object URL if it was created
    if (attachment?.isPending && attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) {
      return
    }

    // If we have a pending file (new banner), we need to create banner first, then upload
    if (pendingFile && !banner) {
      setUploading(true)
      try {
        // Use a minimal placeholder (1x1 transparent pixel) - server requires non-empty attachment
        const PLACEHOLDER_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
        const initialData = {
          name: formData.name.trim(),
          attachment: PLACEHOLDER_URL,
          status: formData.status,
        }
        
        const createResponse = await api.banners.create(initialData)
        const newBanner = createResponse.data || createResponse
        
        if (!newBanner || !newBanner._id) {
          throw new Error('Failed to create banner')
        }

        // Now upload the file
        const formDataUpload = new FormData()
        formDataUpload.append('file', pendingFile)
        formDataUpload.append('entityType', 'banner')
        formDataUpload.append('entityId', newBanner._id || newBanner.id)
        formDataUpload.append('documentType', 'banner_image')
        formDataUpload.append('description', 'Banner image')

        const uploadResponse = await api.documents.upload(formDataUpload)
        const document = uploadResponse.data || uploadResponse

        const fileUrl = document.url || document.filePath || document.attachment

        if (!fileUrl) {
          throw new Error('Failed to get file URL from upload response')
        }

        // Update banner with attachment URL
        const updateData = {
          name: formData.name.trim(),
          attachment: fileUrl,
          fileName: pendingFile.name,
          fileSize: pendingFile.size,
          mimeType: pendingFile.type,
          status: formData.status,
        }

        await api.banners.update(newBanner._id || newBanner.id, updateData)
        
        // Clean up preview URL
        if (attachmentPreview && attachment?.isPending) {
          URL.revokeObjectURL(attachmentPreview)
        }

        toast.success('Success', 'Banner created successfully')
        // Close modal - parent will refresh on close
        onClose()
        // Trigger a custom event or callback to refresh the list
        // For now, we'll let the parent handle refresh when modal closes
      } catch (error) {
        console.error('Error creating banner with file:', error)
        toast.error('Error', error.message || 'Failed to create banner')
        setUploading(false)
        return
      } finally {
        setUploading(false)
      }
      return
    }

    // If editing and no new file uploaded, use existing attachment
    const attachmentData = attachment || (banner?.attachment ? {
      url: banner.attachment,
      fileName: banner.fileName,
      fileSize: banner.fileSize,
      mimeType: banner.mimeType,
    } : null)

    if (!attachmentData || attachmentData.isPending) {
      toast.error('Error', 'Please upload a banner image')
      return
    }

    const submitData = {
      name: formData.name.trim(),
      attachment: attachmentData.url,
      fileName: attachmentData.fileName,
      fileSize: attachmentData.fileSize,
      mimeType: attachmentData.mimeType,
      status: formData.status,
    }

    onSave(submitData)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Banner Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Enter banner name"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Attachment <span className="text-red-500">*</span>
        </label>
        
        {attachmentPreview ? (
          <div className="relative">
            <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <img
                    src={attachmentPreview}
                    alt="Banner preview"
                    className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                  <div className="w-32 h-32 bg-gray-200 rounded-lg border border-gray-200 hidden items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{attachment?.fileName || 'Banner Image'}</p>
                  {attachment?.fileSize && (
                    <p className="text-xs text-gray-500 mt-1">
                      {(attachment.fileSize / 1024 / 1024).toFixed(2)} MB
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleRemoveAttachment}
                  className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remove attachment"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label
              htmlFor="banner-attachment"
              className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                errors.attachment
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
              } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className={`w-8 h-8 mb-2 ${errors.attachment ? 'text-red-500' : 'text-gray-400'}`} />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">PNG, JPG, WebP, GIF (MAX. 10MB)</p>
              </div>
                <input
                id="banner-attachment"
                type="file"
                className="hidden"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                disabled={uploading}
                onClick={(e) => {
                  // Reset input so same file can be selected again
                  e.target.value = ''
                }}
              />
            </label>
            {errors.attachment && <p className="mt-1 text-sm text-red-600">{errors.attachment}</p>}
            {uploading && (
              <p className="mt-2 text-sm text-gray-600">Uploading...</p>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Status <span className="text-red-500">*</span>
        </label>
        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={uploading}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-900 rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {banner ? 'Update Banner' : 'Create Banner'}
        </button>
      </div>
    </form>
  )
}

export default BannerForm

