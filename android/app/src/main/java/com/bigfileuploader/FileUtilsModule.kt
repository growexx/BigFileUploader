package com.bigfileuploader

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.util.Log
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import java.io.BufferedReader
import java.io.InputStreamReader


class FileUtilsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(
        reactContext
    ), ActivityEventListener  {
    private val REQUEST_CODE_PICK_VIDEO = 1
    private var promise: Promise? = null
    init {
        // Register the module to listen to activity events
        reactContext.addActivityEventListener(this)
    }
    override fun getName(): String {
        return "FileUtils"
    }

    // Method to open a document picker and take persistable URI permission
    // Method to open a document picker
    @ReactMethod
    fun openDocumentPicker(promise: Promise) {
        this.promise = promise
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "image/*" // Set the type to pick video files
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }

        val currentActivity = currentActivity
        if (currentActivity != null) {
            currentActivity.startActivityForResult(intent, 42) // Use a request code, e.g., 42
        } else {
            promise.reject("ACTIVITY_ERROR", "Activity doesn't exist")
        }
    }
    // Handling the result of the document picker
    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == 42 && resultCode == Activity.RESULT_OK) {
            val uri: Uri? = data?.data
            if (uri != null) {
                try {
                    // Take persistable URI permission
                    val takeFlags =
                        (data.flags and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION))
                    reactApplicationContext.contentResolver.takePersistableUriPermission(uri, takeFlags)

                    // Resolve the promise with the URI string
                    promise?.resolve(uri.toString())
                } catch (e: SecurityException) {
                    promise?.reject("URI_PERMISSION_ERROR", "Failed to take persistable URI permission: ${e.message}")
                }
            } else {
                promise?.reject("URI_ERROR", "No URI found")
            }
        } else if (requestCode == 42) {
            promise?.reject("PICKER_CANCELLED", "User cancelled the picker")
        }
    }
    override fun onNewIntent(intent: Intent?) {
        // No need to handle new intents in this case
    }
    // Method to take persistable URI permission for a given URI string
    @ReactMethod
    fun takePersistableUriPermission(uriString: String?) {
        if (uriString != null) {
            val uri = Uri.parse(uriString)
            val takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            try {
                if (uri.authority == "com.android.externalstorage.documents") {
                    reactApplicationContext.contentResolver.takePersistableUriPermission(uri, takeFlags)
                    Log.d("PersistPermission", "Persistable permission granted for URI: $uriString")
                } else {
                    Log.e("PersistPermission", "URI does not support persistable permissions")
                }
            } catch (e: SecurityException) {
                Log.e("PersistPermission", "Failed to take persistable URI permission: $e")
            }
        }
    }

    // Method to check for persisted URI permissions
    @ReactMethod
    fun checkPersistedUriPermissions(promise: Promise) {
        val permissionsList = WritableNativeArray()
        val persistedUriPermissions = reactContext.contentResolver.persistedUriPermissions

        for (permission in persistedUriPermissions) {
            val uri = permission.uri.toString()
            val isReadPermission = permission.isReadPermission
            val isWritePermission = permission.isWritePermission

            val uriPermission = WritableNativeMap()
            uriPermission.putString("uri", uri)
            uriPermission.putBoolean("readPermission", isReadPermission)
            uriPermission.putBoolean("writePermission", isWritePermission)

            permissionsList.pushMap(uriPermission)
        }

        promise.resolve(permissionsList)
    }
    @ReactMethod
    fun readFileContent(uriString: String?, promise: Promise) {
        if (uriString != null) {
            val uri = Uri.parse(uriString)
            try {
                val inputStream = reactContext.contentResolver.openInputStream(uri)
                val reader = BufferedReader(InputStreamReader(inputStream))
                val content = reader.readText()
                reader.close()
                promise.resolve(content)
            } catch (e: Exception) {
                promise.reject("READ_FILE_ERROR", "Error reading file content: ${e.message}")
            }
        } else {
            promise.reject("INVALID_URI", "URI is null")
        }
    }
    @ReactMethod
    fun checkManageExternalStoragePermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val hasPermission = Environment.isExternalStorageManager()
            promise.resolve(hasPermission)
        } else {
            promise.reject(
                "Error",
                "Manage External Storage permission is only available on Android 11 and above"
            )
        }
    }
    // Method to get the real file path from URI
    @ReactMethod
    fun getRealPathFromURI(uriString: String?, promise: Promise) {
        val context: Context = reactApplicationContext
        if (uriString == null) {
            promise.reject("Error", "URI is null")
            return
        }
        val uri = Uri.parse(uriString)
        val contentResolver = context.contentResolver

        // Check if the URI is a document
        if (DocumentsContract.isDocumentUri(context, uri)) {
            val filePath = getPathFromDocumentUri(context, uri)
            if (filePath != null) {
                promise.resolve(filePath)
            } else {
                promise.reject("Error", "Unable to resolve document URI")
            }
            return
        }

        // Check if the URI is content
        if ("content" == uri.scheme) {
            // Determine if URI is for video or image based on content type
            val contentType = contentResolver.getType(uri)
            val filePath = when {
                contentType?.startsWith("video/") == true -> getDataColumn(context, uri, isVideo = true, selection = null, selectionArgs = null)
                contentType?.startsWith("image/") == true -> getDataColumn(context, uri, isVideo = false, selection = null, selectionArgs = null)
                else -> null
            }
            if (filePath != null) {
                promise.resolve(filePath)
            } else {
                promise.reject("Error", "Unable to resolve content URI")
            }
            return
        }

        // Check if the URI is a file
        if ("file" == uri.scheme) {
            val filePath = uri.path
            if (filePath != null) {
                promise.resolve(filePath)
            } else {
                promise.reject("Error", "Unable to resolve file URI")
            }
            return
        }

        promise.reject("Error", "Unsupported URI scheme")
    }

    private fun getPathFromDocumentUri(context: Context, uri: Uri): String? {
        val documentId = DocumentsContract.getDocumentId(uri)
        val split = documentId.split(":").toTypedArray()
        val type = split[0]

        return when (type) {
            "image" -> getDataColumn(context, MediaStore.Images.Media.EXTERNAL_CONTENT_URI, isVideo = false, "_id=?", arrayOf(split[1]))
            "video" -> getDataColumn(context, MediaStore.Video.Media.EXTERNAL_CONTENT_URI, isVideo = true, "_id=?", arrayOf(split[1]))
            else -> null
        }
    }
    private fun getDataColumn(context: Context, uri: Uri, isVideo: Boolean, selection: String?, selectionArgs: Array<String>?): String? {
        val column = if (isVideo) MediaStore.Video.Media.DATA else MediaStore.Images.Media.DATA
        val projection = arrayOf(column)
        var cursor: Cursor? = null
        try {
            cursor = context.contentResolver.query(uri, projection, selection, selectionArgs, null)
            if (cursor != null && cursor.moveToFirst()) {
                val columnIndex = cursor.getColumnIndexOrThrow(column)
                return cursor.getString(columnIndex)
            }
        } catch (e: Exception) {
            Log.e("FileUtils", "Error getting data column: $e")
        } finally {
            cursor?.close()
        }
        return null
    }
}
