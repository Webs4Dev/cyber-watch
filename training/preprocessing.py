import pandas as pd
import numpy as np

df = pd.read_csv("../data/combine.csv")

print("Original shape:", df.shape)

# remove infinite values
df.replace([np.inf, -np.inf], np.nan, inplace=True)

# remove missing values
df.dropna(inplace=True)

print("Cleaned shape:", df.shape)

df.to_csv("../data/cleaned_data.csv", index=False)

print("Cleaned dataset saved.")