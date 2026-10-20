package com.urmiaworks.readflow.offline;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.Collections;
import java.util.Arrays;
import java.util.List;

public final class ReadFlowOfflinePackage implements ReactPackage {
    @Override public List<NativeModule> createNativeModules(ReactApplicationContext context) {
        return Arrays.asList(new ReadFlowOfflineModule(context), new ReadFlowSupportModule(context));
    }
    @Override public List<ViewManager> createViewManagers(ReactApplicationContext context) {
        return Collections.emptyList();
    }
}
