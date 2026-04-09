import Api from './Api'

const BackupService = {
  exportBackup: () => Api().get('/api/admin/backup/export', { responseType: 'blob', timeout: 60000 }),
  importBackup: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return Api().post('/api/admin/backup/import', formData, { timeout: 120000 })
  },
  restartApp: () => Api().post('/api/admin/restart'),
}

export default BackupService
