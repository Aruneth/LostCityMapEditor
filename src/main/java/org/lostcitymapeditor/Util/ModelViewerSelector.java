package org.lostcitymapeditor.Util;

import javafx.application.Platform;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.collections.transformation.FilteredList;
import javafx.scene.control.*;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.*;
import javafx.geometry.Insets;
import java.util.*;
import org.lostcitymapeditor.Loaders.FileLoader;
import org.lostcitymapeditor.OriginalCode.*;
import org.lostcitymapeditor.Renderer.ModelViewer;
import org.lostcitymapeditor.Renderer.OpenGLRenderer;

import static org.lostcitymapeditor.OriginalCode.World.findModelWithSuffix;
import static org.lostcitymapeditor.OriginalCode.World.SHAPE_SUFFIX_MAP;

public class ModelViewerSelector extends VBox {
    private final ModelViewer modelViewer;
    private final TextField searchField = new TextField();
    private final ListView<String> modelListView = new ListView<>();
    private final Map<String, Object> locMap;
    private FilteredList<String> filteredModelList;
    private final Label statusLabel = new Label();
    private final ProgressBar loadingProgress = new ProgressBar(0);

    public ModelViewerSelector(ModelViewer modelViewer) {
        this.modelViewer = modelViewer;
        this.locMap = new HashMap<>();

        ObservableList<String> locNames = FXCollections.observableArrayList();
        this.filteredModelList = new FilteredList<>(locNames, p -> true);

        setupUI();

        Platform.runLater(() -> {
            try {
                this.locMap.putAll(FileLoader.getAllLocMap());
                loadInitialItems();
            } catch (Exception e) {
                System.err.println("Error initializing ModelViewerSelector: " + e.getMessage());
            }
        });
    }

    private void setupUI() {
        setPadding(new Insets(10));
        setSpacing(5);

        searchField.setPromptText("Search models...");
        searchField.textProperty().addListener((observable, oldValue, newValue) -> {
            String searchText = newValue.toLowerCase();
            filteredModelList.setPredicate(modelName -> {
                if (searchText == null || searchText.isEmpty()) {
                    return true;
                }
                return modelName.toLowerCase().contains(searchText);
            });
        });

        modelListView.setItems(filteredModelList);
        modelListView.setPrefHeight(300);
        modelListView.getSelectionModel().selectedItemProperty().addListener(
                (observable, oldValue, newValue) -> {
                    if (newValue != null) {
                        loadSelectedModel(newValue, OpenGLRenderer.selectedShape);
                    }
                }
        );

        modelListView.addEventFilter(KeyEvent.KEY_PRESSED, event -> {
            if (!event.isControlDown() && !event.isAltDown() && !event.isShiftDown() &&
                    event.getCode() != KeyCode.UP && event.getCode() != KeyCode.DOWN &&
                    event.getCode() != KeyCode.PAGE_UP && event.getCode() != KeyCode.PAGE_DOWN) {
                searchField.requestFocus();
            }
        });

        statusLabel.setText("Loading locs...");
        Label titleLabel = new Label("Loc Viewer");
        titleLabel.setStyle("-fx-font-weight: bold;");

        getChildren().addAll(titleLabel, searchField, modelListView, statusLabel, loadingProgress);
    }

    private void loadInitialItems() {
        if (locMap == null || locMap.isEmpty()) return;

        List<String> sortedModels = new ArrayList<>(locMap.keySet());
        Collections.sort(sortedModels);

        Platform.runLater(() -> {
            ObservableList<String> source = (ObservableList<String>) filteredModelList.getSource();
            source.setAll(sortedModels);
            statusLabel.setText(String.format("Showing %d locs", source.size()));
        });
    }

    public void updateModel(int shape){
        String selected = modelListView.getSelectionModel().getSelectedItem();
        if (selected != null) {
            loadSelectedModel(selected, shape);
        }
    }

    private void loadSelectedModel(String locName, Integer shape) {
        int locId = -1;
        for (Map.Entry<Integer, String> entry : FileLoader.getLocMap().entrySet()) {
            if (entry.getValue().equals(locName)) {
                locId = entry.getKey();
                break;
            }
        }
        if (locId != -1) {
            LocType loc = LocType.get(locId);
            String modelBaseName = (loc.model != null) ? loc.model : locName;

            String shapeSuffix = SHAPE_SUFFIX_MAP.get(shape);
            Integer modelId = null;

            if (shapeSuffix != null) {
                modelId = FileLoader.getModelMap().get(modelBaseName + shapeSuffix);
            }

            if (modelId == null) {
                modelId = FileLoader.getModelMap().get(modelBaseName);
            }

            if (modelId == null) {
                modelId = findModelWithSuffix(modelBaseName);
            }

            if (modelId != null) {
                LocType locType = new LocType();
                Model model = locType.getModel(modelId, 0, 0, 0, 0, 0, -1, 0, 0);
                if (model != null) {
                    modelViewer.loadModel(model);
                }
            } else {
                System.out.println("Could not find model for: " + modelBaseName + " (Shape: " + shape + ")");
            }
        }
    }

    public String getSelectedModel() {
        return modelListView.getSelectionModel().getSelectedItem();
    }

    public ListView<String> getModelListView() {
        return this.modelListView;
    }
}