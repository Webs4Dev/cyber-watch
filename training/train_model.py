import pandas as pd
import numpy as np
import joblib
from collections import Counter

from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from imblearn.over_sampling import SMOTE

from keras.models import Sequential
from keras.layers import Dense,Input

df = pd.read_csv("../data/cleaned_data.csv")
df.columns = df.columns.str.strip()

df = df.sample(200000, random_state=42)

print("Dataset shape:", df.shape)

X = df.drop("Label", axis=1)
y = df["Label"]


counter = Counter(y)
print("Original class distribution:", counter)

valid_classes = [cls for cls, count in counter.items() if count > 10]

mask = np.isin(y, valid_classes)

X = X[mask]
y = y[mask]

print("After removing rare classes:", Counter(y))

encoder = LabelEncoder()
y = encoder.fit_transform(y)

joblib.dump(encoder, "../models/label_encoder.pkl")

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

scaler = StandardScaler()

X_train = scaler.fit_transform(X_train)
X_test = scaler.transform(X_test)

joblib.dump(scaler, "../models/scaler.pkl")

print("Before SMOTE:", Counter(y_train))

smote = SMOTE(random_state=42, k_neighbors=2)
X_train, y_train = smote.fit_resample(X_train, y_train)

print("After SMOTE:", Counter(y_train))

model = Sequential([
    Input(shape=(X_train.shape[1],)),
    Dense(128, activation="relu"),
    Dense(64, activation="relu"),
    Dense(32, activation="relu"),
    Dense(len(np.unique(y_train)), activation="softmax")
])

model.compile(
    optimizer="adam",
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"]
)

model.fit(
    X_train,
    y_train,
    epochs=20,
    batch_size=256,
    validation_data=(X_test, y_test)
)

loss, accuracy = model.evaluate(X_test, y_test)

print("Test Accuracy:", accuracy)

model.save("../models/attack_detection_NN_model.keras")

print("Model saved successfully!")