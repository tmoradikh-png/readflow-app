const { withAppBuildGradle, withProjectBuildGradle } = require("@expo/config-plugins");

const MARKER = "// @readflow-sherpa-codegen-fix";
const CMAKE_MARKER = "// @readflow-windows-cmake-untracked";

const GRADLE_SNIPPET = `
${MARKER}
afterEvaluate {
    def readflowSherpaProject = rootProject.findProject(":react-native-sherpa-onnx")
    if (readflowSherpaProject != null) {
        tasks.matching { task ->
            task.name.startsWith("configureCMake") ||
            task.name.startsWith("externalNativeBuild")
        }.configureEach { task ->
            ["generateCodegenSchemaFromJavaScript", "generateCodegenArtifactsFromSchema"].each { taskName ->
                def codegenTask = readflowSherpaProject.tasks.findByName(taskName)
                if (codegenTask != null) {
                    task.dependsOn(codegenTask)
                }
            }
        }
    }
}
`;

const PROJECT_GRADLE_SNIPPET = `
${CMAKE_MARKER}
if (System.properties["os.name"].toLowerCase().contains("windows")) {
    subprojects { subproject ->
        def readflowNativeBuildTasks = tasks.matching { candidate ->
            candidate.name.startsWith("buildCMake") ||
            candidate.name.startsWith("configureCMake") ||
            candidate.name.startsWith("externalNativeBuild")
        }
        def readflowNormalizeScript = '''
param([string]$root)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $root)) { return }
$count = 0
Get-ChildItem -LiteralPath $root -Recurse -Force -Filter "*.so" -ErrorAction SilentlyContinue | Where-Object {
    -not $_.PSIsContainer -and (($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)
} | ForEach-Object {
    $path = $_.FullName
    $bytes = [System.IO.File]::ReadAllBytes($path)
    Remove-Item -LiteralPath $path -Force
    [System.IO.File]::WriteAllBytes($path, $bytes)
    $script:count++
}
Write-Output $count
'''
        def readflowNormalizeNativeOutputs = tasks.register("readflowNormalizeNativeOutputs") {
            mustRunAfter(readflowNativeBuildTasks)
            doLast {
                def output = new ByteArrayOutputStream()
                exec {
                    executable "powershell"
                    args "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "& { " + readflowNormalizeScript + " }", subproject.buildDir.absolutePath
                    standardOutput = output
                }
                def normalized = output.toString().trim()
                def normalizedCount = normalized.isInteger() ? normalized.toInteger() : 0
                if (normalizedCount > 0) {
                    logger.lifecycle("ReadFlow normalized " + normalizedCount + " Windows native outputs in " + subproject.path)
                }
            }
        }

        tasks.configureEach { task ->
            def isNativeBuildTask = task.name.startsWith("buildCMake") ||
                task.name.startsWith("configureCMake") ||
                task.name.startsWith("externalNativeBuild")
            def isNativeMergeTask = task.name.startsWith("merge") && task.name.endsWith("NativeLibs")

            if (isNativeBuildTask || isNativeMergeTask) {
                task.doNotTrackState("ReadFlow: Windows/NDK generated .so outputs can be reparse files and Gradle cannot snapshot them reliably.")
            }
            if (isNativeMergeTask) {
                task.dependsOn(readflowNormalizeNativeOutputs)
            }
        }
    }
}
`;

module.exports = function withSherpaCodegenGradleFix(config) {
  config = withAppBuildGradle(config, (config) => {
    const buildGradle = config.modResults;
    if (buildGradle.language !== "groovy" || buildGradle.contents.includes(MARKER)) {
      return config;
    }
    buildGradle.contents = `${buildGradle.contents.trimEnd()}\n${GRADLE_SNIPPET}`;
    return config;
  });
  return withProjectBuildGradle(config, (config) => {
    const buildGradle = config.modResults;
    if (buildGradle.language !== "groovy" || buildGradle.contents.includes(CMAKE_MARKER)) {
      return config;
    }
    buildGradle.contents = `${buildGradle.contents.trimEnd()}\n${PROJECT_GRADLE_SNIPPET}`;
    return config;
  });
};
