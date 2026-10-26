package com.urmiaworks.readflow.offline;

import com.tom_roush.pdfbox.cos.COSDictionary;
import com.tom_roush.pdfbox.cos.COSName;
import com.tom_roush.pdfbox.cos.COSObject;
import java.util.HashSet;
import org.junit.Test;
import static org.junit.Assert.*;

public class PdfImageMetadataTest {
    private COSDictionary resources(COSDictionary object) {
        COSDictionary objects = new COSDictionary();
        objects.setItem(COSName.getPDFName("item"), object);
        COSDictionary resources = new COSDictionary();
        resources.setItem(COSName.XOBJECT, objects);
        return resources;
    }

    private COSDictionary image() {
        COSDictionary image = new COSDictionary();
        image.setItem(COSName.SUBTYPE, COSName.IMAGE);
        // Deliberately no image stream or decoder: detection must be metadata-only.
        image.setItem(COSName.FILTER, COSName.JPX_DECODE);
        image.setInt(COSName.WIDTH, 50000);
        image.setInt(COSName.HEIGHT, 50000);
        return image;
    }

    private boolean detect(COSDictionary value) {
        return ReadFlowOfflineModule.hasImage(value, new HashSet<>(), 0);
    }

    @Test public void recognizesImageWithoutDecoding() {
        assertTrue(detect(resources(image())));
    }

    @Test public void recognizesNestedFormAndIndirectImage() throws Exception {
        COSDictionary inner = resources(image());
        COSDictionary objects = (COSDictionary) inner.getDictionaryObject(COSName.XOBJECT);
        objects.setItem(COSName.getPDFName("item"), new COSObject(image()));
        COSDictionary form = new COSDictionary();
        form.setItem(COSName.SUBTYPE, COSName.FORM);
        form.setItem(COSName.RESOURCES, inner);
        assertTrue(detect(resources(form)));
    }

    @Test public void cycleAndMalformedResourcesTerminate() {
        COSDictionary form = new COSDictionary();
        form.setItem(COSName.SUBTYPE, COSName.FORM);
        COSDictionary cyclic = resources(form);
        form.setItem(COSName.RESOURCES, cyclic);
        assertFalse(detect(cyclic));
        assertFalse(detect(null));
        COSDictionary malformed = new COSDictionary();
        malformed.setItem(COSName.XOBJECT, COSName.IMAGE);
        assertFalse(detect(malformed));
        assertFalse(detect(resources(new COSDictionary())));
    }

    @Test public void boundsTraversalDepth() {
        assertFalse(ReadFlowOfflineModule.hasImage(resources(image()), new HashSet<>(), 13));
    }
}
