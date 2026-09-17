#include <iostream>
#include <fstream>
#include <sstream>
#include <algorithm>
#include <iomanip>
#include <limits>
#include <queue>
#include <set>
#include <stdexcept>
#include "Graph.h"
using namespace std;

void Graph::addEdge(const string &from, const string &to, const string &pathway,
                    const string &direction, int distance, double speed) {
    adjList[from].push_back({to, pathway, direction, distance, speed});
}

PathInfo Graph::dijkstra(const string &start, const string &end, bool shortest) {
    unordered_map<string, double> pathWeight;//account for time and distance with one variable
    unordered_map<string, edge> previousEdge;
    unordered_map<string, string> previous; //tracks path
    set<string> visited;

    if(start == end) {
        cout << "You're already there" << endl;
        return{};
    }

    for (const auto &pair: adjList) {
        pathWeight[pair.first] = numeric_limits<double>::max();
    }

    pathWeight[start] = 0.0;//initializing this before the for loop breaks everything

    priority_queue<pair<string, double>, vector<pair<string,double>>,greater<>> pq;
    pq.emplace(start, 0.0);
    while (!pq.empty()) {
        pair<string, double> top = pq.top();
        pq.pop();
        string current = top.first;

        if (visited.count(current)) {
            continue; //checks visited nodes and keeps pushing
        }
        visited.insert(current);

        for (const auto &edge: adjList[current]) {//loop goes through current nodes
            double newWeight;
            if (shortest) {//weight will determine which path it takes
                //weight is distance
                newWeight = pathWeight[current] + edge.distance;
            } else {
                //weight is time
                newWeight = pathWeight[current] + (edge.distance / edge.speed) / 60.0;
            }
            /*instead of splitting this into shortest v quickest have pathWeight handle it.
             took wayyy too long to realize i could do it that way*/
            if(newWeight < pathWeight[edge.toBuilding]) {
                pathWeight[edge.toBuilding] = newWeight;
                previous[edge.toBuilding] = current;
                previousEdge[edge.toBuilding] = edge;
                pq.emplace(edge.toBuilding, newWeight);
            }
        }
    }
    //reconstructs graph
    vector<string> path;
    vector<edge> pathwayEdges;
    int totalDistance  = 0;
    double totalTime = 0.0;

    for (string at = end; !at.empty(); at = previous[at]) {
        path.insert(path.begin(), at);
        if(previous.count(at)) {
            edge e = previousEdge[at];
            pathwayEdges.insert(pathwayEdges.begin(), e);
            totalDistance += e.distance;
            totalTime += (e.distance / e.speed) / 60.0;
        }
    }
    if(path.empty() || path.front() != start) {
        cout << "No valid path from " << start << " to " << end << endl;
    }
    return {path, pathwayEdges,totalDistance, totalTime};
};

void quickSort(vector<string> &list, int low, int high) {
    if (low < high) {
        int pivotIndex = partition(list, low, high);
        quickSort(list, low, pivotIndex - 1);
        quickSort(list, pivotIndex + 1, high);
    }
};

int partition(vector<string> &list, int low, int high) {
    string pivot = list[high];
    int i = low - 1;
    for (int j = low; j < high; j++) {
        if (list[j] < pivot) {
            i++;
            swap(list[i], list[j]);
        }
    }
    swap(list[i + 1], list[high]);
    return i + 1;
}

void readCSV(const string &filename, Graph &graph, vector<string> &buildings) {
    try {
        ifstream file(filename);
        if (!file.is_open()) {
            throw runtime_error("File could not be opened");
        }

        string line;
        while (getline(file, line)) {
            stringstream ss(line);
            string from, pathway, to, direction, distanceStr, speedStr;
            getline(ss, from, ',');
            getline(ss, pathway, ',');
            getline(ss, to, ',');
            getline(ss, direction, ',');
            getline(ss, distanceStr, ',');
            getline(ss, speedStr, ',');

            int distance = stoi(distanceStr);
            double speed = stod(speedStr);

            graph.addEdge(from, to, pathway, direction, distance, speed);
            buildings.push_back(from);
        }
        file.close();
    } catch (const exception &e) {
        cerr << "Error occured: " << e.what() << endl;
    }
}

int main() {
    Graph graph;
    vector<string> building;
    string filename = "../fgcu.csv";

    readCSV(filename, graph, building);

    quickSort(building, 0, building.size() - 1);
    building.erase(unique(building.begin(), building.end()), building.end());

    //theres gotta be a way to handle this better
    cout << "Program is case sensitive careful about inputs" << endl;
    //or is it dependent on how it is in the file?
    string start, end;
    int route;
    cout << "Enter the starting building:";
    getline(cin,start);
    cout << "Enter final destination:";
    getline(cin, end);
    cout << "Which route would you like? \n1) Shortest or 2) Quickest: ";
    cin >> route;

    if (route == 1) {
        PathInfo shortest = graph.dijkstra(start, end, true);
        cout << "From " << start << endl;
        for (const auto &edge : shortest.pathwayEdges) {
            cout << "Take " << edge.pathway << " " << edge.direction
            << " to " << edge.toBuilding << " " << edge.distance << "ft" << endl;
        }
        cout << "Distance: " << shortest.totalDistance << "ft" << endl;
        cout << "Time: " << fixed << setprecision(2) << shortest.totalTime << " min" << endl;
    }else if (route == 2) {
        PathInfo quickest = graph.dijkstra(start, end, false);
        cout << "From " << start << endl;
        for (const auto &edge : quickest.pathwayEdges) {
            cout << "Take " << edge.pathway << " " << edge.direction
            << " to " << edge.toBuilding << " " << edge.distance << "ft" << endl;
        }
        cout << "Time: " << fixed << setprecision(2) << quickest.totalTime << " min" << endl;
        cout << "Distance: " << quickest.totalDistance << "ft" << endl;
    }else {
        throw runtime_error("There is no such route in the graph");
    }
    return 0;
}

