package com.urmiaworks.readflow.offline;

import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.util.Xml;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.googlecode.tesseract.android.TessBaseAPI;
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader;
import com.tom_roush.pdfbox.cos.COSBase;
import com.tom_roush.pdfbox.cos.COSDictionary;
import com.tom_roush.pdfbox.cos.COSName;
import com.tom_roush.pdfbox.io.MemoryUsageSetting;
import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.pdmodel.PDResources;
import com.tom_roush.pdfbox.text.PDFTextStripper;
import com.tom_roush.pdfbox.text.TextPosition;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import org.xmlpull.v1.XmlPullParser;

/** All document processing is local, serial and off the React/UI thread. */
public final class ReadFlowOfflineModule extends ReactContextBaseJavaModule {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private PDDocument document;
    private String documentPath;
    private static final Set<String> LANGUAGES = new HashSet<>(Arrays.asList(
        "eng", "deu", "fra", "spa", "ita", "por", "nld", "swe", "nor", "dan", "fin",
        "tur", "ind", "vie", "jpn", "kor", "chi_sim", "hin", "rus", "ara", "fas", "tha"));

    public ReadFlowOfflineModule(ReactApplicationContext context) {
        super(context);
        PDFBoxResourceLoader.init(context);
    }

    @Override public String getName() { return "ReadFlowOffline"; }

    private interface Work { Object run() throws Exception; }
    private void submit(Promise promise, Work work) {
        worker.execute(() -> {
            try { promise.resolve(work.run()); }
            catch (OutOfMemoryError error) {
                closeDocument();
                promise.reject("local_memory", "This document exceeds the memory available on this phone.");
            } catch (Exception error) {
                promise.reject("local_document", error.getMessage(), error);
            }
        });
    }

    private File localFile(String value) throws IOException {
        Uri uri = Uri.parse(value);
        if (!"file".equals(uri.getScheme())) throw new IOException("A private local file is required.");
        File file = new File(uri.getPath()).getCanonicalFile();
        String path = file.getPath();
        String files = getReactApplicationContext().getFilesDir().getCanonicalPath() + File.separator;
        String cache = getReactApplicationContext().getCacheDir().getCanonicalPath() + File.separator;
        if (!path.startsWith(files) && !path.startsWith(cache)) throw new IOException("File is outside app storage.");
        if (!file.isFile()) throw new IOException("The saved document is missing. Import it again.");
        return file;
    }

    private PDDocument open(String uri) throws IOException {
        File file = localFile(uri);
        if (document == null || !file.getPath().equals(documentPath)) {
            closeDocument();
            MemoryUsageSetting memory = MemoryUsageSetting.setupMixed(8L * 1024 * 1024);
            memory.setTempDir(getReactApplicationContext().getCacheDir());
            document = PDDocument.load(file, memory);
            documentPath = file.getPath();
            if (!document.getCurrentAccessPermission().canExtractContent()) {
                closeDocument();
                throw new IOException("This PDF does not permit text extraction.");
            }
        }
        return document;
    }

    private void closeDocument() {
        if (document != null) try { document.close(); } catch (IOException ignored) { }
        document = null;
        documentPath = null;
    }

    @ReactMethod public void pageCount(String uri, Promise promise) {
        submit(promise, () -> open(uri).getNumberOfPages());
    }

    @ReactMethod public void extractPage(String uri, int page, Promise promise) {
        submit(promise, () -> {
            PDDocument pdf = open(uri);
            if (page < 1 || page > pdf.getNumberOfPages()) throw new IOException("Invalid page number.");
            WritableArray items = Arguments.createArray();
            float height = pdf.getPage(page - 1).getCropBox().getHeight();
            PDFTextStripper stripper = new PDFTextStripper() {
                @Override protected void writeString(String text, List<TextPosition> positions) {
                    for (TextPosition position : positions) {
                        String value = position.getUnicode();
                        if (value == null || value.isEmpty()) continue;
                        WritableMap item = Arguments.createMap();
                        float size = Math.max(0.1f, position.getFontSizeInPt());
                        item.putString("str", value);
                        item.putString("fontName", position.getFont() == null ? "" : position.getFont().getName());
                        item.putDouble("width", position.getWidthDirAdj());
                        item.putDouble("height", size);
                        WritableArray transform = Arguments.createArray();
                        transform.pushDouble(size); transform.pushDouble(0);
                        transform.pushDouble(0); transform.pushDouble(size);
                        transform.pushDouble(position.getXDirAdj());
                        transform.pushDouble(height - position.getYDirAdj());
                        item.putArray("transform", transform);
                        items.pushMap(item);
                    }
                }
            };
            stripper.setStartPage(page);
            stripper.setEndPage(page);
            stripper.setSortByPosition(false);
            stripper.getText(pdf);
            WritableMap result = Arguments.createMap();
            result.putArray("items", items);
            result.putDouble("pageHeight", height);
            PDResources resources = pdf.getPage(page - 1).getResources();
            result.putBoolean("hasRasterImage", hasImage(resources == null ? null : resources.getCOSObject(), new HashSet<>(), 0));
            return result;
        });
    }

    static boolean hasImage(COSDictionary resources, Set<Object> seen, int depth) {
        if (resources == null || depth > 12 || !seen.add(resources)) return false;
        COSBase objects = resources.getDictionaryObject(COSName.XOBJECT);
        if (!(objects instanceof COSDictionary)) return false;
        COSDictionary xobjects = (COSDictionary) objects;
        // Inspect metadata only. Constructing PDImageXObject can decode JPX image data.
        for (COSName name : xobjects.keySet()) {
            COSBase value = xobjects.getDictionaryObject(name);
            if (!(value instanceof COSDictionary)) continue;
            COSDictionary object = (COSDictionary) value;
            COSBase subtype = object.getDictionaryObject(COSName.SUBTYPE);
            if (COSName.IMAGE.equals(subtype)) return true;
            COSBase nested = object.getDictionaryObject(COSName.RESOURCES);
            if (COSName.FORM.equals(subtype) && nested instanceof COSDictionary
                && hasImage((COSDictionary) nested, seen, depth + 1)) return true;
        }
        return false;
    }

    private File languageDirectory(String lang) throws IOException {
        File root = new File(getReactApplicationContext().getFilesDir(), "readflow-ocr");
        File directory = new File(root, "tessdata");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Cannot create OCR storage.");
        for (String code : lang.split("\\+")) {
            if (!LANGUAGES.contains(code)) throw new IOException("Unsupported OCR language.");
            File target = new File(directory, code + ".traineddata");
            if (!target.isFile()) {
                File temporary = new File(directory, code + ".part");
                try (InputStream input = getReactApplicationContext().getAssets().open("tessdata/" + code + ".traineddata");
                     FileOutputStream output = new FileOutputStream(temporary)) {
                    byte[] buffer = new byte[65536];
                    int count;
                    while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                } catch (IOException error) {
                    temporary.delete();
                    throw new IOException("The offline OCR language pack is missing: " + code, error);
                }
                if (!temporary.renameTo(target)) throw new IOException("Cannot install the offline OCR pack.");
            }
        }
        return root;
    }

    @ReactMethod public void ocrPage(String uri, int page, String language, Promise promise) {
        submit(promise, () -> {
            String lang = LANGUAGES.contains(language) ? language : "eng";
            String workers = "eng".equals(lang) ? lang : lang + "+eng";
            File packs = languageDirectory(workers);
            Bitmap bitmap = null;
            TessBaseAPI tess = new TessBaseAPI();
            try (ParcelFileDescriptor descriptor = ParcelFileDescriptor.open(localFile(uri), ParcelFileDescriptor.MODE_READ_ONLY);
                 PdfRenderer renderer = new PdfRenderer(descriptor)) {
                if (page < 1 || page > renderer.getPageCount()) throw new IOException("Invalid OCR page number.");
                try (PdfRenderer.Page source = renderer.openPage(page - 1)) {
                    double scale = Math.min(2.5, Math.sqrt(6000000.0 / ((double) source.getWidth() * source.getHeight())));
                    bitmap = Bitmap.createBitmap(Math.max(1, (int) (source.getWidth() * scale)),
                        Math.max(1, (int) (source.getHeight() * scale)), Bitmap.Config.ARGB_8888);
                    bitmap.eraseColor(Color.WHITE);
                    source.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT);
                }
                if (!tess.init(packs.getAbsolutePath(), workers, TessBaseAPI.OEM_LSTM_ONLY)) {
                    throw new IOException("The offline OCR engine could not load its language pack.");
                }
                tess.setPageSegMode(TessBaseAPI.PageSegMode.PSM_AUTO);
                tess.setVariable("user_defined_dpi", "300");
                tess.setVariable("preserve_interword_spaces", "1");
                tess.setImage(bitmap);
                WritableMap result = Arguments.createMap();
                result.putInt("page", page);
                result.putString("text", tess.getUTF8Text());
                result.putInt("confidence", tess.meanConfidence());
                return result;
            } finally {
                tess.recycle();
                if (bitmap != null) bitmap.recycle();
            }
        });
    }

    @ReactMethod public void extractDocx(String uri, Promise promise) {
        submit(promise, () -> {
            try (ZipFile zip = new ZipFile(localFile(uri))) {
                ZipEntry entry = zip.getEntry("word/document.xml");
                if (entry == null || entry.getSize() > 64L * 1024 * 1024) throw new IOException("Unsupported Word document.");
                try (InputStream input = zip.getInputStream(entry)) {
                    XmlPullParser parser = Xml.newPullParser();
                    parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, true);
                    parser.setInput(input, "UTF-8");
                    StringBuilder text = new StringBuilder();
                    boolean insideText = false;
                    int event;
                    while ((event = parser.next()) != XmlPullParser.END_DOCUMENT) {
                        String name = parser.getName();
                        if (event == XmlPullParser.START_TAG) {
                            if ("t".equals(name)) insideText = true;
                            else if ("tab".equals(name)) text.append('\t');
                            else if ("br".equals(name) || "cr".equals(name)) text.append('\n');
                        } else if (event == XmlPullParser.TEXT && insideText) {
                            text.append(parser.getText());
                        } else if (event == XmlPullParser.END_TAG) {
                            if ("t".equals(name)) insideText = false;
                            if ("p".equals(name)) text.append("\n\n");
                        }
                        if (text.length() > 16000000) throw new IOException("This Word document is too large for local import.");
                    }
                    return text.toString();
                }
            }
        });
    }

    @ReactMethod public void releaseDocument(Promise promise) {
        submit(promise, () -> { closeDocument(); return null; });
    }

    @Override public void invalidate() {
        worker.execute(this::closeDocument);
        worker.shutdown();
        super.invalidate();
    }
}
