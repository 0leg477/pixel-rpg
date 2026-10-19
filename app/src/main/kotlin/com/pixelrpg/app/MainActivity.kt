package com.pixelrpg.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.ui.Modifier
import com.pixelrpg.app.ui.components.PixelBackground
import com.pixelrpg.app.ui.screens.GameScreen
import com.pixelrpg.app.ui.screens.MenuScreen
import com.pixelrpg.app.ui.screens.MessageDialog
import com.pixelrpg.app.ui.screens.SettingsScreen
import com.pixelrpg.app.ui.screens.WorkshopScreen
import com.pixelrpg.app.ui.screens.WorldsScreen
import com.pixelrpg.app.ui.theme.PixelTheme

class MainActivity : ComponentActivity() {
    private val vm: AppViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { AppRoot(vm) { finish() } }
    }
}

@Composable
fun AppRoot(vm: AppViewModel, exit: () -> Unit) {
    val prefs by vm.uiPrefs.collectAsStateWithLifecycle()
    val screen by vm.screen.collectAsStateWithLifecycle()
    val message by vm.message.collectAsStateWithLifecycle()
    PixelTheme(prefs) {
        PixelBackground(Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxSize().safeDrawingPadding().imePadding()) {
                BackHandler { if (!vm.back()) exit() }
                when (screen) {
                    Screen.MENU -> MenuScreen(vm)
                    Screen.WORLDS -> WorldsScreen(vm)
                    Screen.SETTINGS -> SettingsScreen(vm)
                    Screen.WORKSHOP -> WorkshopScreen(vm)
                    Screen.GAME -> GameScreen(vm)
                }
                message?.let { MessageDialog(it) { vm.dismissMessage() } }
            }
        }
    }
}
