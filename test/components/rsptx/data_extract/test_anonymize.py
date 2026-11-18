import pandas as pd

from rsptx.data_extract.anonymizeCourseData import find_closest


def _poss():
    df = pd.DataFrame(
        {
            "sid": ["a", "a", "a", "b"],
            "acid": ["x", "x", "x", "x"],
            "timestamp": pd.to_datetime(
                [
                    "2024-01-01 00:00:00",
                    "2024-01-01 00:01:00",
                    "2024-01-01 00:01:00",  # duplicate timestamp
                    "2024-01-01 00:00:00",
                ]
            ),
            "anon_code": ["c1", "c2", "c3", "c4"],
        }
    )
    return df.set_index(["sid", "acid", "timestamp"]).sort_index()


def test_find_closest_picks_nearest_timestamp():
    poss = _poss()
    assert find_closest("a", "x", pd.Timestamp("2024-01-01 00:00:03"), poss) == (
        pd.Timestamp("2024-01-01 00:00:00")
    )
    # Duplicate timestamps used to make an index lookup fail; nearest still works.
    assert find_closest("a", "x", pd.Timestamp("2024-01-01 00:00:50"), poss) == (
        pd.Timestamp("2024-01-01 00:01:00")
    )


def test_find_closest_missing_key_or_time_is_nat():
    poss = _poss()
    assert pd.isna(find_closest("nobody", "x", pd.Timestamp("2024-01-01"), poss))
    assert pd.isna(find_closest("a", "x", pd.NaT, poss))
