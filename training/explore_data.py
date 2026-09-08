import pandas as pd

df = pd.read_csv("../data/combine.csv")
df.columns = df.columns.str.strip()

print("Dataset Shape:", df.shape)

print("\nColumns:")
print(df.columns)

print("\nFirst rows:")
print(df.head())

print("\nAttack types:")
print(df["Label"].value_counts())