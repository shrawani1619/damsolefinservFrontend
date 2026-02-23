import { useState, useEffect } from 'react'
import { Upload, X, FileText } from 'lucide-react'
import api from '../services/api'
import { toast } from '../services/toastService'

const PLACEHOLDER_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const Form16Form = ({ form16, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    attachmentName: '',
    attachmentDate: '',
    formType: 'form16',
  })

  const [attachment, setAttachment] = useState(null)
  const [attachmentPreview, setAttachmentPreview] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (form16) {
      setFormData({
        attachmentName: form16.attachmentName || '',
        attachmentDate: form16.attachmentDate
          ? new Date(form16.attachmentDate).toISOString().slice(0, 10)
          : '',
        formType: form16.formType || 'form16',
      })
      if (form16.attachment) {
        setAttachmentPreview(form16.attachment)
      }
    } else {
      setFormData({
        attachmentName: '',
        attachmentDate: '',
        formType: 'form16',
      })
      setAttachment(null)
      setAttachmentPreview(null)
      setPendingFile(null)
    }
  }, [form16])

  const validate = () => {
    const newErrors = {}
    if (!formData.attachmentDate) {
      newErrors.attachmentDate = 'Attachment date is required'
    }
    if (!attachment && !attachmentPreview && !pendingFile) {
      newErrors.attachment = 'Attachment is required'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
    ]
    if (!validTypes.includes(file.type)) {
      toast.error('Error', 'Please upload PDF or image (JPEG, PNG, WebP, GIF)')
      return
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      toast.error('Error', 'File size must be less than 10MB')
      return
    }

    if (form16 && (form16._id || form16.id)) {
      setUploading(true)
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('entityType', 'form16')
        fd.append('entityId', form16._id || form16.id)
        fd.append('documentType', 'form16_attachment')
        fd.append('description', 'Form 16 / TDS attachment')

        const resp = await api.documents.upload(fd)
        const doc = resp.data || resp
        const fileUrl = doc.url || doc.filePath || doc.attachment

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
          throw new Error('Failed to get file URL')
        }
      } catch (error) {
        console.error('File upload error:', error)
        toast.error('Upload Failed', error.message || 'Failed to upload file')
      } finally {
        setUploading(false)
      }
    } else {
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
    if (attachment?.isPending && attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    if (pendingFile && !form16) {
      setUploading(true)
      try {
        const initialData = {
          formType: formData.formType,
          attachmentName: formData.attachmentName?.trim() || '',
          attachment: PLACEHOLDER_URL,
          attachmentDate: formData.attachmentDate,
          status: 'active',
        }

        const createResp = await api.form16.create(initialData)
        const newForm = createResp.data || createResp

        if (!newForm || !newForm._id) throw new Error('Failed to create record')

        const fd = new FormData()
        fd.append('file', pendingFile)
        fd.append('entityType', 'form16')
        fd.append('entityId', newForm._id || newForm.id)
        fd.append('documentType', 'form16_attachment')
        fd.append('description', 'Form 16 / TDS attachment')

        const uploadResp = await api.documents.upload(fd)
        const doc = uploadResp.data || uploadResp
        const fileUrl = doc.url || doc.filePath || doc.attachment

        if (!fileUrl) throw new Error('Failed to get file URL')

        const updateData = {
          formType: formData.formType,
          attachmentName: formData.attachmentName?.trim() || '',
          attachment: fileUrl,
          attachmentDate: formData.attachmentDate,
          fileName: pendingFile.name,
          fileSize: pendingFile.size,
          mimeType: pendingFile.type,
          status: 'active',
        }

        await api.form16.update(newForm._id || newForm.id, updateData)

        if (attachmentPreview && attachment?.isPending) {
          URL.revokeObjectURL(attachmentPreview)
        }

        toast.success('Success', 'Form 16 created successfully')
        onClose()
      } catch (error) {
        console.error('Error creating Form 16:', error)
        toast.error('Error', error.message || 'Failed to create')
      } finally {
        setUploading(false)
      }
      return
    }

    const attachmentData =
      attachment ||
      (form16?.attachment
        ? {
            url: form16.attachment,
            fileName: form16.fileName,
            fileSize: form16.fileSize,
            mimeType: form16.mimeType,
          }
        : null)

    if (!attachmentData || attachmentData.isPending) {
      toast.error('Error', 'Please upload an attachment')
      return
    }

    const submitData = {
      formType: formData.formType,
      attachmentName: formData.attachmentName?.trim() || '',
      attachment: attachmentData.url,
      attachmentDate: formData.attachmentDate,
      fileName: attachmentData.fileName,
      fileSize: attachmentData.fileSize,
      mimeType: attachmentData.mimeType,
      status: 'active',
    }

    onSave(submitData)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Attachment Name
        </label>
        <input
          type="text"
          name="attachmentName"
          value={formData.attachmentName}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Enter attachment name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Attachment Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          name="attachmentDate"
          value={formData.attachmentDate}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.attachmentDate ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.attachmentDate && (
          <p className="mt-1 text-sm text-red-600">{errors.attachmentDate}</p>
        )}
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
                  <FileText className="w-12 h-12 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {attachment?.fileName || 'Form 16 Attachment'}
                  </p>
                  {attachment?.fileSize && (
                    <p className="text-xs text-gray-500 mt-1">
                      {(attachment.fileSize / 1024).toFixed(1)} KB
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
              htmlFor="form16-attachment"
              className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                errors.attachment
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
              } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload
                  className={`w-8 h-8 mb-2 ${
                    errors.attachment ? 'text-red-500' : 'text-gray-400'
                  }`}
                />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">PDF, PNG, JPG, WebP, GIF (MAX. 10MB)</p>
              </div>
              <input
                id="form16-attachment"
                type="file"
                className="hidden"
                accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                disabled={uploading}
                onClick={(e) => (e.target.value = '')}
              />
            </label>
            {errors.attachment && (
              <p className="mt-1 text-sm text-red-600">{errors.attachment}</p>
            )}
            {uploading && <p className="mt-2 text-sm text-gray-600">Uploading...</p>}
          </div>
        )}
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
          {form16 ? 'Update' : 'Create Form 16'}
        </button>
      </div>
    </form>
  )
}

export default Form16Form

