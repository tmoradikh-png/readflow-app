const { withAppBuildGradle } = require("@expo/config-plugins");

const MARKER = "// @readflow-sherpa-codegen-fix";

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

module.exports = function withSherpaCodegenGradleFix(config) {
  return withAppBuildGradle(config, (config) => {
    const buildGradle = config.modResults;
    if (buildGradle.language !== "groovy" || buildGradle.contents.includes(MARKER)) {
      return config;
    }
    buildGradle.contents = `${buildGradle.contents.trimEnd()}\n${GRADLE_SNIPPET}`;
    return config;
  });
};
