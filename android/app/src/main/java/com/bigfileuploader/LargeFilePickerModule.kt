package com.bigfileuploader

import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.provider.DocumentsContract
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import android.app.Activity
import android.database.Cursor
import android.provider.MediaStore
import android.provider.OpenableColumns
import com.facebook.react.bridge.BaseActivityEventListener
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

class LargeFilePickerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    init {
        reactContext.addActivityEventListener(object : BaseActivityEventListener() {
            override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
                super.onActivityResult(activity, requestCode, resultCode, data)
                if (requestCode == REQUEST_CODE_PICK_FILE && resultCode == Activity.RESULT_OK) {
                    val uri: Uri? = data?.data
                    if (uri != null) {
                        // Emit URI string back to React Native
                        sendEvent(reactContext, "FilePicked", uri.toString())
                    } else {
                        sendEvent(reactContext, "FilePicked", "No file selected")
                    }
                }
            }
        })
    }

    override fun getName(): String {
        return "LargeFilePicker"
    }

    @ReactMethod
    fun openFilePicker() {
        val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
            type = "*/*"
            addCategory(Intent.CATEGORY_OPENABLE)
        }
        currentActivity?.startActivityForResult(Intent.createChooser(intent, "Select a file"), REQUEST_CODE_PICK_FILE)
    }

    @ReactMethod
    fun getFileDetails(uriString: String, callback: Callback) {
        try {
            val uri: Uri = Uri.parse(uriString)
            val fileName = getFileName(uri)
            val filePath = getFilePath(uri)

            if (filePath != null) {
                callback.invoke(null, mapOf("fileName" to fileName, "filePath" to filePath))
            } else {
                callback.invoke("File path could not be resolved")
            }
        } catch (e: Exception) {
            callback.invoke(e.message)
        }
    }

    private fun getFileName(uri: Uri): String? {
        var fileName: String? = null
        val cursor: Cursor? = currentActivity?.contentResolver?.query(uri, null, null, null, null)

        cursor?.use {
            if (it.moveToFirst()) {
                val nameIndex = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                fileName = it.getString(nameIndex)
            }
        }
        return fileName
    }

    private fun getFilePath(uri: Uri): String? {
        // Check if the document URI is from a file, external storage, or another provider
        return when {
            isExternalStorageDocument(uri) -> getExternalStoragePath(uri)
            isDownloadsDocument(uri) -> getDownloadsPath(uri)
            isMediaDocument(uri) -> getMediaDocumentPath(uri)
            else -> {
                // Copy the file to a temporary location and return the new file path
                copyFileToTemp(uri)
            }
        }
    }

    private fun getExternalStoragePath(uri: Uri): String? {
        val docId = DocumentsContract.getDocumentId(uri)
        val split = docId.split(":")
        val type = split[0]
        val filePath = split[1]

        return if ("primary".equals(type, true)) {
            "${Environment.getExternalStorageDirectory()}/$filePath"
        } else {
            null // Handle other types of storage if necessary
        }
    }

    private fun getDownloadsPath(uri: Uri): String? {
        val id = DocumentsContract.getDocumentId(uri)
        val contentUri = Uri.parse("content://downloads/public_downloads").buildUpon()
            .appendPath(id).build()

        return queryFilePath(contentUri)
    }

    private fun getMediaDocumentPath(uri: Uri): String? {
        val docId = DocumentsContract.getDocumentId(uri)
        val split = docId.split(":")
        val type = split[0]
        val contentUri = when (type) {
            "image" -> MediaStore.Images.Media.EXTERNAL_CONTENT_URI
            "video" -> MediaStore.Video.Media.EXTERNAL_CONTENT_URI
            "audio" -> MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
            else -> null
        }

        val selection = "_id=?"
        val selectionArgs = arrayOf(split[1])
        return queryFilePath(contentUri, selection, selectionArgs)
    }

    private fun queryFilePath(uri: Uri?, selection: String? = null, selectionArgs: Array<String>? = null): String? {
        val cursor = currentActivity?.contentResolver?.query(uri ?: return null, arrayOf(MediaStore.MediaColumns.DATA), selection, selectionArgs, null)
        cursor?.use {
            if (it.moveToFirst()) {
                val columnIndex = it.getColumnIndexOrThrow(MediaStore.MediaColumns.DATA)
                return it.getString(columnIndex)
            }
        }
        return null
    }

    private fun copyFileToTemp(uri: Uri): String? {
        val inputStream: InputStream? = currentActivity?.contentResolver?.openInputStream(uri)
        val fileName = getFileName(uri) ?: return null
        val tempFile = File(currentActivity?.cacheDir, fileName)

        inputStream?.use { input ->
            val outputStream = FileOutputStream(tempFile)
            outputStream.use { output ->
                val buffer = ByteArray(1024)
                var bytesRead: Int
                while (input.read(buffer).also { bytesRead = it } != -1) {
                    output.write(buffer, 0, bytesRead)
                }
            }
        }
        return tempFile.absolutePath
    }

    private fun sendEvent(reactContext: ReactContext, eventName: String, params: String) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    companion object {
        private const val REQUEST_CODE_PICK_FILE = 1
    }

    private fun isExternalStorageDocument(uri: Uri): Boolean {
        return "com.android.externalstorage.documents" == uri.authority
    }

    private fun isDownloadsDocument(uri: Uri): Boolean {
        return "com.android.providers.downloads.documents" == uri.authority
    }

    private fun isMediaDocument(uri: Uri): Boolean {
        return "com.android.providers.media.documents" == uri.authority
    }
}
