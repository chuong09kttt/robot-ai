class NavClient:

    def go_to(self, destination):

        print("Navigating to:", destination)

        return {
            "status": "moving",
            "target": destination
        }
