package com.bigfileuploader

import android.content.Context
import android.net.Uri
import android.provider.MediaStore
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod


class FileUtilsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(
        reactContext
    ) {
    override fun getName(): String {
        return "FileUtils"
    }

    @ReactMethod
    fun getRealPathFromURI(uriString: String?, promise: Promise) {
        try {
            val uri = Uri.parse(uriString)
            val context: Context = reactApplicationContext
            val contentResolver = context.contentResolver
            val projection = arrayOf(MediaStore.Images.Media.DATA)
            val cursor = contentResolver.query(uri, projection, null, null, null)
            if (cursor != null && cursor.moveToFirst()) {
                val columnIndex = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATA)
                val filePath = cursor.getString(columnIndex)
                cursor.close()
                promise.resolve(filePath)
            } else {
                promise.reject("Error", "Unable to resolve URI")
            }
        } catch (e: Exception) {
            promise.reject("Error", e)
        }
    }
}
